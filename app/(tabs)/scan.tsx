import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { registerAttendance } from '@/lib/attendance';

export default function ScanScreen() {
  const { user } = useAuth();

  const [permission, requestPermission] =
    useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [lastData, setLastData] = useState<string | null>(
    null
  );
  const [message, setMessage] = useState<string | null>(
    null
  );
  const [success, setSuccess] = useState(false);
  const [processing, setProcessing] = useState(false);

  /*
   * React state updates are asynchronous.
   *
   * A camera can fire multiple barcode callbacks before
   * `scanned` becomes true.
   *
   * This ref prevents duplicate processing.
   */
  const processingRef = useRef(false);

  // ----------------------------------------------------------
  // Camera permission hasn't loaded yet.
  // ----------------------------------------------------------
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.subtitle}>
          Loading camera...
        </Text>
      </View>
    );
  }

  // ----------------------------------------------------------
  // Camera permission denied.
  // ----------------------------------------------------------
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.title}>
          Camera Permission Needed
        </Text>

        <Text style={styles.subtitle}>
          We need access to your camera to scan QR codes.
        </Text>

        <AppButton
          theme="primary"
          title="Grant Permission"
          icon="camera"
          onPress={requestPermission}
        />
      </View>
    );
  }

  // ----------------------------------------------------------
  // QR scanner callback.
  // ----------------------------------------------------------
  const handleBarcodeScanned = async ({
    data,
  }: {
    data: string;
  }) => {
    // Prevent multiple callbacks for the same scan.
    if (processingRef.current) {
      return;
    }

    processingRef.current = true;

    setScanned(true);
    setLastData(data);
    setMessage(null);
    setSuccess(false);
    setProcessing(true);

    // --------------------------------------------------------
    // Require authentication.
    // --------------------------------------------------------
    if (!user?.id) {
      setMessage(
        'Please log in as a student before scanning attendance.'
      );
      setSuccess(false);
      setProcessing(false);
      processingRef.current = false;
      return;
    }

    try {
      const result = await registerAttendance(
        data,
        user.id
      );

      setMessage(result.message);
      setSuccess(result.success);
    } catch (error) {
      console.error(
        'Attendance registration error:',
        error
      );

      setMessage(
        'Something went wrong while recording attendance.'
      );
      setSuccess(false);
    } finally {
      setProcessing(false);
      processingRef.current = false;
    }
  };

  // ----------------------------------------------------------
  // Allow another scan.
  // ----------------------------------------------------------
  const handleScanAgain = () => {
    processingRef.current = false;

    setScanned(false);
    setLastData(null);
    setMessage(null);
    setSuccess(false);
    setProcessing(false);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={
          scanned ? undefined : handleBarcodeScanned
        }
      />

      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          {processing
            ? 'Recording attendance...'
            : scanned
              ? 'QR Code detected!'
              : 'Point your camera at a QR code'}
        </Text>

        {scanned && message && (
          <Text
            style={[
              styles.scanResult,
              success
                ? styles.success
                : styles.error,
            ]}
          >
            {message}
          </Text>
        )}

        {scanned && lastData && (
          <Text
            style={styles.scanData}
            numberOfLines={3}
          >
            {lastData}
          </Text>
        )}

        {scanned && !processing && (
          <AppButton
            theme="primary"
            title="Scan Again"
            icon="refresh"
            onPress={handleScanAgain}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  permissionContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  camera: {
    ...StyleSheet.absoluteFillObject,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },

  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 60,

    backgroundColor: COLORS.card,

    borderRadius: 14,

    padding: 16,

    alignItems: 'center',
  },

  overlayText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },

  scanResult: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },

  success: {
    color: '#2E7D32',
  },

  error: {
    color: '#C62828',
  },

  scanData: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
});