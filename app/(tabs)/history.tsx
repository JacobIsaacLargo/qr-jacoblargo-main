import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';

export default function HistoryScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);

  const [studentRecords, setStudentRecords] = useState<
    AttendanceRecord[]
  >([]);

  const [teacherEvents, setTeacherEvents] = useState<
    TeacherEventAttendance[]
  >([]);

  const load = useCallback(async () => {
    if (!user) {
      setRole(null);
      setStudentRecords([]);
      setTeacherEvents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const profile = await getProfile(user.id);

      /*
       * If the profile cannot be loaded, don't automatically assume
       * teacher. Defaulting to student is safer for this screen.
       */
      const currentRole: Role =
        profile?.role === 'teacher'
          ? 'teacher'
          : 'student';

      setRole(currentRole);

      if (currentRole === 'teacher') {
        const events = await getTeacherEventAttendance(
          user.id
        );

        setTeacherEvents(events);
        setStudentRecords([]);
      } else {
        const records = await getAttendanceHistory(user.id);

        setStudentRecords(records);
        setTeacherEvents([]);
      }
    } catch (error) {
      console.error('History load error:', error);

      setStudentRecords([]);
      setTeacherEvents([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ----------------------------------------------------------
  // Loading
  // ----------------------------------------------------------
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          Attendance History
        </Text>

        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="small"
            color={COLORS.primary}
          />

          <Text style={styles.subtitle}>
            Loading records...
          </Text>
        </View>
      </View>
    );
  }

  // ----------------------------------------------------------
  // Not logged in
  // ----------------------------------------------------------
  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          Attendance History
        </Text>

        <Text style={styles.subtitle}>
          Please log in to view your attendance history.
        </Text>
      </View>
    );
  }

  // ==========================================================
  // TEACHER HISTORY
  // ==========================================================
  if (role === 'teacher') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          Attendance History
        </Text>

        {teacherEvents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              No events yet
            </Text>

            <Text style={styles.subtitle}>
              Events you create will appear here together with
              the students who scan their QR codes.
            </Text>
          </View>
        ) : (
          <FlatList
            data={teacherEvents}
            keyExtractor={(item) => item.eventId}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.card}>
                {/* Event header */}
                <View style={styles.eventHeader}>
                  <Text
                    style={styles.eventTitle}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>

                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>
                      {item.attendeeCount}
                    </Text>
                  </View>
                </View>

                {/* Event code */}
                <Text style={styles.eventMeta}>
                  Event Code: {item.eventCode}
                </Text>

                {/* Event date */}
                {item.startTime && (
                  <Text style={styles.eventMeta}>
                    {formatDate(item.startTime)}
                  </Text>
                )}

                {/* Attendees */}
                {item.attendees.length === 0 ? (
                  <View style={styles.emptyAttendeeBox}>
                    <Text style={styles.attendeeEmpty}>
                      No attendees yet.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.attendeeList}>
                    {item.attendees.map(
                      (attendee, index) => (
                        <View
                          key={`${attendee.studentId}-${attendee.scannedAt}-${index}`}
                          style={styles.attendeeRow}
                        >
                          <View style={styles.attendeeInfo}>
                            <Text
                              style={styles.attendeeName}
                              numberOfLines={1}
                            >
                              {attendee.studentName ||
                                shortId(
                                  attendee.studentId
                                )}
                            </Text>

                            <Text style={styles.eventMeta}>
                              {formatDate(
                                attendee.scannedAt
                              )}
                            </Text>
                          </View>
                        </View>
                      )
                    )}
                  </View>
                )}
              </View>
            )}
          />
        )}
      </View>
    );
  }

  // ==========================================================
  // STUDENT HISTORY
  // ==========================================================
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Attendance History
      </Text>

      {studentRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>
            No attendance records
          </Text>

          <Text style={styles.subtitle}>
            Scan a teacher's QR code to register your
            attendance.
          </Text>
        </View>
      ) : (
        <FlatList
          data={studentRecords}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text
                style={styles.eventTitle}
                numberOfLines={2}
              >
                {item.eventTitle || 'Unknown Event'}
              </Text>

              {item.eventId ? (
                <Text style={styles.eventMeta}>
                  Event Code: {item.eventId}
                </Text>
              ) : null}

              <Text style={styles.eventMeta}>
                {formatDate(item.scannedAt)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function formatDate(iso: string) {
  if (!iso) {
    return 'Unknown date';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString();
}

function shortId(id: string) {
  if (!id) {
    return 'Unknown student';
  }

  return `Student …${id.slice(-8)}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 32,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
  },

  emptyContainer: {
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 12,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  list: {
    paddingBottom: 24,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,

    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
    flex: 1,
  },

  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },

  countBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginLeft: 12,
    minWidth: 34,
    alignItems: 'center',
  },

  countText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  attendeeList: {
    marginTop: 12,
  },

  attendeeRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 10,
  },

  attendeeInfo: {
    flex: 1,
  },

  attendeeName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  emptyAttendeeBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  attendeeEmpty: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});