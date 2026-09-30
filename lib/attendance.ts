import { supabase } from './supabase';
import { parseQRPayload } from './qr';
import { getEventByCode } from './events';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;
  attendees: {
    studentId: string;
    studentName: string | null;
    scannedAt: string;
  }[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

/**
 * Register a student's attendance from a QR code.
 */
export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  // Never allow an empty/invalid student ID.
  if (!studentId || studentId === 'unknown') {
    return {
      success: false,
      message: 'You must be logged in as a student to record attendance.',
    };
  }

  const parsed = parseQRPayload(rawPayload);

  if (!parsed.ok) {
    return {
      success: false,
      message: parsed.message,
    };
  }

  const payload = parsed.payload;

  // Check whether the QR event is currently valid.
  const now = Date.now();

  const start = payload.start
    ? new Date(payload.start).getTime()
    : null;

  const end = payload.end
    ? new Date(payload.end).getTime()
    : null;

  if (start && Number.isFinite(start) && now < start) {
    return {
      success: false,
      message: 'Event has not started yet.',
    };
  }

  if (end && Number.isFinite(end) && now > end) {
    return {
      success: false,
      message: 'Event has already ended.',
    };
  }

  const title = payload.title ?? payload.event;

  /*
   * First look for the event in Supabase.
   *
   * Normally every QR code should correspond to an event
   * created by the teacher.
   */
  let event: {
    id: string;
    title: string;
  } | null = null;

  const foundEvent = await getEventByCode(payload.event);

  if (foundEvent) {
    event = {
      id: foundEvent.id,
      title: foundEvent.title,
    };
  } else {
    /*
     * Keep the existing fallback behavior in case an older QR
     * code exists without a corresponding event record.
     */
    const { data: newEvent, error: insertError } = await supabase
      .from('events')
      .insert([
        {
          event_code: payload.event,
          title,
          start_time: payload.start ?? null,
          end_time: payload.end ?? null,
        },
      ])
      .select('id, title')
      .single();

    if (insertError || !newEvent) {
      return {
        success: false,
        message: 'Could not find or create this event.',
      };
    }

    event = newEvent;
  }

  /*
   * Insert the attendance record.
   *
   * The database has a UNIQUE(student_id, event_id) constraint,
   * so scanning the same event twice will be rejected.
   */
  const { error: attError } = await supabase
    .from('attendance')
    .insert([
      {
        student_id: studentId,
        event_id: event.id,
      },
    ]);

  if (attError) {
    if (attError.code === '23505') {
      return {
        success: false,
        message: 'Already registered for this event.',
        eventTitle: event.title,
      };
    }

    return {
      success: false,
      message: attError.message || 'Could not record attendance.',
    };
  }

  return {
    success: true,
    message: 'Attendance recorded!',
    eventTitle: event.title,
  };
}

/**
 * Get attendance history for the currently logged-in student.
 */
export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  if (!studentId) {
    return [];
  }

  const { data, error } = await supabase
    .from('attendance')
    .select(
      `
        id,
        scanned_at,
        event_id,
        events (
          event_code,
          title
        )
      `
    )
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error || !data) {
    console.error('getAttendanceHistory error:', error);
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    eventId: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? 'Unknown Event',
    scannedAt: row.scanned_at,
  }));
}

/**
 * Get all events created by a teacher and the students
 * who attended those events.
 *
 * IMPORTANT:
 * This intentionally does NOT use:
 *
 * profiles ( full_name, email )
 *
 * inside the attendance query.
 *
 * Instead, attendance and profiles are queried separately.
 * This avoids the nested Supabase relationship/RLS issue
 * that can cause the entire teacher history to return empty.
 */
export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  if (!teacherId) {
    return [];
  }

  // ----------------------------------------------------------
  // 1. Get the teacher's events.
  // ----------------------------------------------------------
  const {
    data: events,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      'id, event_code, title, start_time, end_time, created_at'
    )
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError) {
    console.error(
      'getTeacherEventAttendance events error:',
      eventError
    );
    return [];
  }

  if (!events || events.length === 0) {
    return [];
  }

  const eventIds = events.map((event: any) => event.id);

  // ----------------------------------------------------------
  // 2. Get attendance separately.
  // ----------------------------------------------------------
  const {
    data: attendance,
    error: attendanceError,
  } = await supabase
    .from('attendance')
    .select('id, student_id, scanned_at, event_id')
    .in('event_id', eventIds)
    .order('scanned_at', { ascending: false });

  if (attendanceError) {
    console.error(
      'getTeacherEventAttendance attendance error:',
      attendanceError
    );

    /*
     * We still return the teacher's events.
     *
     * This means History can show:
     *   Event Name
     *   Event Code
     *   0 attendees
     *
     * instead of completely appearing empty.
     */
    return events.map((event: any) => ({
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      attendeeCount: 0,
      attendees: [],
    }));
  }

  const attendanceRows = attendance ?? [];

  // ----------------------------------------------------------
  // 3. Get unique student IDs.
  // ----------------------------------------------------------
  const studentIds = [
    ...new Set(
      attendanceRows
        .map((row: any) => row.student_id)
        .filter(Boolean)
    ),
  ];

  // ----------------------------------------------------------
  // 4. Get profiles separately.
  // ----------------------------------------------------------
  const profileMap: Record<
    string,
    {
      full_name: string | null;
      email: string | null;
    }
  > = {};

  if (studentIds.length > 0) {
    const {
      data: profiles,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', studentIds);

    if (profileError) {
      console.error(
        'getTeacherEventAttendance profiles error:',
        profileError
      );
    } else {
      (profiles ?? []).forEach((profile: any) => {
        profileMap[profile.id] = {
          full_name: profile.full_name ?? null,
          email: profile.email ?? null,
        };
      });
    }
  }

  // ----------------------------------------------------------
  // 5. Build the final teacher history.
  // ----------------------------------------------------------
  return events.map((event: any) => {
    const rows = attendanceRows.filter(
      (attendanceRow: any) =>
        attendanceRow.event_id === event.id
    );

    return {
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      attendeeCount: rows.length,

      attendees: rows.map((attendanceRow: any) => {
        const profile = profileMap[attendanceRow.student_id];

        return {
          studentId: attendanceRow.student_id,
          studentName:
            profile?.full_name ??
            profile?.email ??
            null,
          scannedAt: attendanceRow.scanned_at,
        };
      }),
    };
  });
}

/**
 * Get a simple event/attendee count summary for a teacher.
 */
export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  if (!teacherId) {
    return [];
  }

  const {
    data: events,
    error: eventError,
  } = await supabase
    .from('events')
    .select('id, event_code, title, created_at')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError) {
    console.error(
      'getTeacherEventSummary events error:',
      eventError
    );
    return [];
  }

  if (!events || events.length === 0) {
    return [];
  }

  const eventIds = events.map((event: any) => event.id);

  const {
    data: attRows,
    error: attError,
  } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError) {
    console.error(
      'getTeacherEventSummary attendance error:',
      attError
    );

    // Still return events with zero attendees.
    return events.map((event: any) => ({
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      attendeeCount: 0,
    }));
  }

  const counts: Record<string, number> = {};

  (attRows ?? []).forEach((row: any) => {
    counts[row.event_id] =
      (counts[row.event_id] ?? 0) + 1;
  });

  return events.map((event: any) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    attendeeCount: counts[event.id] ?? 0,
  }));
}