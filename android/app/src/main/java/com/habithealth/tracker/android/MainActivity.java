package com.habithealth.tracker.android;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.app.KeyguardManager;
import android.hardware.biometrics.BiometricPrompt;
import android.media.MediaRecorder;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.util.Base64;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;

import com.getcapacitor.BridgeActivity;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static final int DEVICE_CREDENTIAL_REQUEST = 4217;
    private static final int AUDIO_PERMISSION_REQUEST = 4219;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 4220;
    private static final String REMINDER_CHANNEL_ID = "health_task_tracker_reminders";
    private static final String CRISIS_CHANNEL_ID = "health_task_tracker_crisis_alerts";
    private static final long[] CRISIS_VIBRATION_PATTERN = new long[]{0, 900, 250, 900, 250, 1200, 350, 1200};
    private WebView printWebView;
    private String pendingCredentialCallbackId;
    private String pendingPermissionSpeechCallbackId;
    private String pendingPermissionAudioCallbackId;
    private String activeSpeechCallbackId;
    private String activeAudioCallbackId;
    private SpeechRecognizer speechRecognizer;
    private Intent speechIntent;
    private MediaRecorder nativeAudioRecorder;
    private File nativeAudioFile;
    private final StringBuilder speechTranscript = new StringBuilder();
    private String lastPartialTranscript = "";
    private boolean speechManuallyStopping = false;
    private final Handler speechRestartHandler = new Handler(Looper.getMainLooper());
    private final Runnable speechPartialCommitRunnable = new Runnable() {
        @Override
        public void run() {
            if (activeSpeechCallbackId == null || speechManuallyStopping) {
                return;
            }

            appendPartialSpeechResult();
            speechRestartHandler.postDelayed(this, 3000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hardenMedicalDataPrivacy();
        registerPrintBridge();
        registerSecurityBridge();
        registerDictationBridge();
        registerAudioRecorderBridge();
        registerKeyboardBridge();
        registerNotificationBridge();
        handleFacebookRedirect(getIntent());
    }

    private void hardenMedicalDataPrivacy() {
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        WebView.setWebContentsDebuggingEnabled(false);
        if (this.bridge == null || this.bridge.getWebView() == null) {
            return;
        }
        WebView webView = this.bridge.getWebView();
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleFacebookRedirect(intent);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == DEVICE_CREDENTIAL_REQUEST && pendingCredentialCallbackId != null) {
            String callbackId = pendingCredentialCallbackId;
            pendingCredentialCallbackId = null;
            sendSecurityResult(callbackId, resultCode == RESULT_OK, resultCode == RESULT_OK ? "" : "Device unlock canceled.");
            return;
        }

    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST) {
            return;
        }
        if (requestCode != AUDIO_PERMISSION_REQUEST || (pendingPermissionSpeechCallbackId == null && pendingPermissionAudioCallbackId == null)) {
            return;
        }

        String audioCallbackId = pendingPermissionAudioCallbackId;
        String speechCallbackId = pendingPermissionSpeechCallbackId;
        pendingPermissionAudioCallbackId = null;
        pendingPermissionSpeechCallbackId = null;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            if (audioCallbackId != null) {
                beginNativeAudioRecording(audioCallbackId);
            }
            if (speechCallbackId != null) {
                beginLongDictation(speechCallbackId);
            }
        } else {
            if (audioCallbackId != null) {
                sendNativeAudioResult(audioCallbackId, false, "", "", "Microphone permission is needed for dictation.");
            }
            if (speechCallbackId != null) {
                sendDictationResult(speechCallbackId, false, "", "Microphone permission is needed for dictation.");
            }
        }
    }

    private void handleFacebookRedirect(Intent intent) {
        if (intent == null || intent.getData() == null || this.bridge == null) {
            return;
        }

        Uri data = intent.getData();
        if (!"fb2422428068229609".equals(data.getScheme())) {
            return;
        }

        String appUrl = "https://localhost/";
        String fragment = data.getEncodedFragment();
        String query = data.getEncodedQuery();
        if (fragment != null && !fragment.isEmpty()) {
            appUrl = appUrl + "#" + fragment;
        } else if (query != null && !query.isEmpty()) {
            appUrl = appUrl + "?" + query;
        }

        WebView webView = this.bridge.getWebView();
        String finalAppUrl = appUrl;
        webView.post(() -> webView.loadUrl(finalAppUrl));
    }

    private void registerPrintBridge() {
        if (this.bridge == null) {
            return;
        }

        WebView webView = this.bridge.getWebView();
        if (webView == null) {
            return;
        }

        webView.addJavascriptInterface(new PrintBridge(), "HealthTaskPrint");
    }

    private void registerSecurityBridge() {
        if (this.bridge == null) {
            return;
        }

        WebView webView = this.bridge.getWebView();
        if (webView == null) {
            return;
        }

        webView.addJavascriptInterface(new SecurityBridge(), "HealthTaskSecurity");
    }

    private void registerDictationBridge() {
        if (this.bridge == null) {
            return;
        }

        WebView webView = this.bridge.getWebView();
        if (webView == null) {
            return;
        }

        webView.addJavascriptInterface(new DictationBridge(), "HealthTaskDictation");
    }

    private void registerAudioRecorderBridge() {
        if (this.bridge == null) {
            return;
        }

        WebView webView = this.bridge.getWebView();
        if (webView == null) {
            return;
        }

        webView.addJavascriptInterface(new AudioRecorderBridge(), "HealthTaskAudioRecorder");
    }

    private void registerKeyboardBridge() {
        if (this.bridge == null) {
            return;
        }

        WebView webView = this.bridge.getWebView();
        if (webView == null) {
            return;
        }

        webView.addJavascriptInterface(new KeyboardBridge(), "HealthTaskKeyboard");
    }

    private void registerNotificationBridge() {
        if (this.bridge == null) {
            return;
        }

        WebView webView = this.bridge.getWebView();
        if (webView == null) {
            return;
        }

        webView.addJavascriptInterface(new NotificationBridge(), "HealthTaskNotifications");
    }

    private boolean isDeviceSecure() {
        KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        return keyguardManager != null && keyguardManager.isDeviceSecure();
    }

    private void sendSecurityResult(String callbackId, boolean success, String message) {
        if (this.bridge == null || callbackId == null) {
            return;
        }

        WebView webView = this.bridge.getWebView();
        if (webView == null) {
            return;
        }

        String safeId = callbackId.replace("\\", "\\\\").replace("'", "\\'");
        String safeMessage = message == null ? "" : message.replace("\\", "\\\\").replace("'", "\\'");
        String script = "window.__nativeBiometricResult && window.__nativeBiometricResult('" + safeId + "', " + success + ", '" + safeMessage + "')";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private String escapeForJavascript(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    private void sendDictationResult(String callbackId, boolean success, String transcript, String message) {
        if (this.bridge == null || callbackId == null) {
            return;
        }

        WebView webView = this.bridge.getWebView();
        if (webView == null) {
            return;
        }

        String safeId = escapeForJavascript(callbackId);
        String safeTranscript = escapeForJavascript(transcript);
        String safeMessage = escapeForJavascript(message);
        String script = "window.__nativeDictationResult && window.__nativeDictationResult('" + safeId + "', " + success + ", '" + safeTranscript + "', '" + safeMessage + "')";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void sendNativeAudioResult(String callbackId, boolean success, String audioBase64, String mimeType, String message) {
        if (this.bridge == null || callbackId == null) {
            return;
        }

        WebView webView = this.bridge.getWebView();
        if (webView == null) {
            return;
        }

        String safeId = escapeForJavascript(callbackId);
        String safeAudio = escapeForJavascript(audioBase64);
        String safeMimeType = escapeForJavascript(mimeType);
        String safeMessage = escapeForJavascript(message);
        String script = "window.__nativeAudioDictationResult && window.__nativeAudioDictationResult('" + safeId + "', " + success + ", '" + safeAudio + "', '" + safeMimeType + "', '" + safeMessage + "')";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private boolean hasAudioPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasNotificationPermission() {
        return Build.VERSION.SDK_INT < 33
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && !hasNotificationPermission()) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
        }
    }

    private void ensureReminderNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(REMINDER_CHANNEL_ID) != null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
                REMINDER_CHANNEL_ID,
                "Task reminders",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Upcoming tasks, deadlines, and health reminders.");
        manager.createNotificationChannel(channel);
    }

    private void ensureCrisisNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CRISIS_CHANNEL_ID) != null) {
            return;
        }

        Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmSound == null) {
            alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        NotificationChannel channel = new NotificationChannel(
                CRISIS_CHANNEL_ID,
                "AI Coach crisis alerts",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Urgent AI Coach safety alerts from journal and mood warning signs.");
        channel.enableVibration(true);
        channel.setVibrationPattern(CRISIS_VIBRATION_PATTERN);
        channel.enableLights(true);
        channel.setSound(alarmSound, audioAttributes);
        channel.setBypassDnd(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    private void showNativeNotification(String title, String body, String tag) {
        if (!hasNotificationPermission()) {
            requestNotificationPermissionIfNeeded();
            return;
        }

        boolean crisisAlert = tag != null && tag.startsWith("wellbeing:journal") && tag.contains("crisis");
        ensureReminderNotificationChannel();
        if (crisisAlert) {
            ensureCrisisNotificationChannel();
        }
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, pendingIntentFlags);
        String channelId = crisisAlert ? CRISIS_CHANNEL_ID : REMINDER_CHANNEL_ID;
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, channelId)
                : new Notification.Builder(this);
        builder.setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setShowWhen(true);

        if (crisisAlert) {
            builder.setCategory(Notification.CATEGORY_ALARM)
                    .setVisibility(Notification.VISIBILITY_PUBLIC)
                    .setFullScreenIntent(pendingIntent, true)
                    .setVibrate(CRISIS_VIBRATION_PATTERN)
                    .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM));
        }

        if (tag != null && tag.startsWith("wellbeing:")) {
            builder.addAction(R.mipmap.ic_launcher, "Text 911", createSmsPendingIntent("911", "I need help right now.", stableSmsRequestCode(tag, "911")));
            if (canSendSmsTo("988")) {
                builder.addAction(R.mipmap.ic_launcher, "Text 988", createSmsPendingIntent("988", "I need crisis support.", stableSmsRequestCode(tag, "988")));
            } else {
                builder.addAction(R.mipmap.ic_launcher, "Call 988", createCallPendingIntent("988", stableSmsRequestCode(tag, "988")));
            }
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setPriority(crisisAlert ? Notification.PRIORITY_MAX : Notification.PRIORITY_DEFAULT);
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        String stableTag = tag == null || tag.trim().isEmpty() ? title + ":" + body : tag;
        manager.notify(Math.abs(stableTag.hashCode()), builder.build());
    }

    private PendingIntent createSmsPendingIntent(String number, String message, int requestCode) {
        Intent smsIntent = createSmsIntent(number);
        smsIntent.putExtra("sms_body", message);

        int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        return PendingIntent.getActivity(this, requestCode, smsIntent, pendingIntentFlags);
    }

    private PendingIntent createCallPendingIntent(String number, int requestCode) {
        Intent callIntent = new Intent(Intent.ACTION_DIAL);
        callIntent.setData(Uri.parse("tel:" + number));

        int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        return PendingIntent.getActivity(this, requestCode, callIntent, pendingIntentFlags);
    }

    private Intent createSmsIntent(String number) {
        Intent smsIntent = new Intent(Intent.ACTION_SENDTO);
        smsIntent.setData(Uri.parse("smsto:" + number));
        return smsIntent;
    }

    private boolean canSendSmsTo(String number) {
        return createSmsIntent(number).resolveActivity(getPackageManager()) != null;
    }

    private int stableSmsRequestCode(String tag, String number) {
        return Math.abs((String.valueOf(tag) + ":sms:" + number).hashCode());
    }

    private String currentDictationTranscript() {
        String transcript = speechTranscript.toString().trim();
        String partial = lastPartialTranscript == null ? "" : lastPartialTranscript.trim();
        if (!partial.isEmpty() && !transcript.endsWith(partial)) {
            transcript = (transcript + " " + partial).trim();
        }
        return transcript;
    }

    private void appendSpeechResult(ArrayList<String> results) {
        if (results == null || results.isEmpty()) {
            return;
        }

        String result = results.get(0);
        if (result == null || result.trim().isEmpty()) {
            return;
        }

        appendPhraseToTranscript(result.trim());
        lastPartialTranscript = "";
    }

    private void appendPhraseToTranscript(String phrase) {
        if (phrase == null || phrase.trim().isEmpty()) {
            return;
        }

        String cleanPhrase = phrase.trim();
        String transcript = speechTranscript.toString().trim();
        if (transcript.isEmpty()) {
            speechTranscript.setLength(0);
            speechTranscript.append(cleanPhrase);
        } else if (transcript.equals(cleanPhrase) || transcript.endsWith(cleanPhrase)) {
            return;
        } else if (cleanPhrase.startsWith(transcript)) {
            speechTranscript.setLength(0);
            speechTranscript.append(cleanPhrase);
        } else {
            String suffix = getNonOverlappingSuffix(transcript, cleanPhrase);
            if (suffix.isEmpty()) {
                return;
            }
            speechTranscript.append(" ");
            speechTranscript.append(suffix);
        }
    }

    private String getNonOverlappingSuffix(String transcript, String phrase) {
        int maxOverlap = Math.min(transcript.length(), phrase.length());
        for (int length = maxOverlap; length > 0; length--) {
            String transcriptEnd = transcript.substring(transcript.length() - length).toLowerCase(Locale.US);
            String phraseStart = phrase.substring(0, length).toLowerCase(Locale.US);
            if (transcriptEnd.equals(phraseStart)) {
                return phrase.substring(length).trim();
            }
        }
        return phrase.trim();
    }

    private void appendPartialSpeechResult() {
        if (lastPartialTranscript == null || lastPartialTranscript.trim().isEmpty()) {
            return;
        }

        ArrayList<String> partialResults = new ArrayList<>();
        partialResults.add(lastPartialTranscript);
        appendSpeechResult(partialResults);
    }

    private void beginLongDictation(String callbackId) {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            sendDictationResult(callbackId, false, "", "Speech recognition is not available on this device.");
            return;
        }

        stopSpeechRecognizerOnly();
        activeSpeechCallbackId = callbackId;
        speechTranscript.setLength(0);
        lastPartialTranscript = "";
        speechManuallyStopping = false;
        speechIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
        speechIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        speechIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        speechIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 5000);
        speechIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500);
        speechIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1000);

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {}

            @Override
            public void onBeginningOfSpeech() {}

            @Override
            public void onRmsChanged(float rmsdB) {}

            @Override
            public void onBufferReceived(byte[] buffer) {}

            @Override
            public void onEndOfSpeech() {
                appendPartialSpeechResult();
            }

            @Override
            public void onError(int error) {
                appendPartialSpeechResult();
                if (speechManuallyStopping) {
                    finishLongDictation(true, "");
                } else if (activeSpeechCallbackId != null) {
                    restartSpeechRecognizer();
                }
            }

            @Override
            public void onResults(Bundle results) {
                appendSpeechResult(results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION));
                if (speechManuallyStopping) {
                    finishLongDictation(true, "");
                } else {
                    restartSpeechRecognizer();
                }
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                ArrayList<String> results = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                lastPartialTranscript = results != null && !results.isEmpty() ? results.get(0) : "";
            }

            @Override
            public void onEvent(int eventType, Bundle params) {}
        });
        speechRecognizer.startListening(speechIntent);
        speechRestartHandler.postDelayed(speechPartialCommitRunnable, 3000);
    }

    private void restartSpeechRecognizer() {
        if (speechRecognizer == null || speechIntent == null || activeSpeechCallbackId == null) {
            return;
        }

        speechRestartHandler.postDelayed(() -> {
            if (speechRecognizer == null || speechIntent == null || activeSpeechCallbackId == null || speechManuallyStopping) {
                return;
            }
            try {
                speechRecognizer.cancel();
                speechRecognizer.startListening(speechIntent);
            } catch (Exception exception) {
                finishLongDictation(!currentDictationTranscript().isEmpty(), "Speech recognition stopped.");
            }
        }, 350);
    }

    private void stopSpeechRecognizerOnly() {
        speechRestartHandler.removeCallbacksAndMessages(null);
        if (speechRecognizer != null) {
            try {
                speechRecognizer.cancel();
                speechRecognizer.destroy();
            } catch (Exception ignored) {
                // Best effort cleanup.
            }
        }
        speechRecognizer = null;
    }

    private void finishLongDictation(boolean success, String message) {
        String callbackId = activeSpeechCallbackId;
        String transcript = currentDictationTranscript();
        activeSpeechCallbackId = null;
        speechManuallyStopping = false;
        stopSpeechRecognizerOnly();
        speechTranscript.setLength(0);
        lastPartialTranscript = "";
        sendDictationResult(callbackId, success && !transcript.isEmpty(), transcript, transcript.isEmpty() ? "No speech recognized." : message);
    }

    private void beginNativeAudioRecording(String callbackId) {
        try {
            cleanupNativeAudioRecording(false);
            activeAudioCallbackId = callbackId;
            nativeAudioFile = File.createTempFile("health-task-dictation-", ".m4a", getCacheDir());
            nativeAudioRecorder = new MediaRecorder();
            nativeAudioRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            nativeAudioRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            nativeAudioRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            nativeAudioRecorder.setAudioEncodingBitRate(32000);
            nativeAudioRecorder.setAudioSamplingRate(16000);
            nativeAudioRecorder.setAudioChannels(1);
            nativeAudioRecorder.setOutputFile(nativeAudioFile.getAbsolutePath());
            nativeAudioRecorder.prepare();
            nativeAudioRecorder.start();
        } catch (Exception exception) {
            String message = exception.getMessage() == null ? "Native audio recording could not start." : exception.getMessage();
            cleanupNativeAudioRecording(true);
            activeAudioCallbackId = null;
            sendNativeAudioResult(callbackId, false, "", "", message);
        }
    }

    private void finishNativeAudioRecording() {
        String callbackId = activeAudioCallbackId;
        activeAudioCallbackId = null;
        try {
            if (nativeAudioRecorder != null) {
                nativeAudioRecorder.stop();
            }
            String audioBase64 = readNativeAudioBase64();
            cleanupNativeAudioRecording(true);
            if (audioBase64.isEmpty()) {
                sendNativeAudioResult(callbackId, false, "", "", "No audio was recorded.");
                return;
            }
            sendNativeAudioResult(callbackId, true, audioBase64, "audio/mp4", "");
        } catch (Exception exception) {
            String message = exception.getMessage() == null ? "Native audio recording could not finish." : exception.getMessage();
            cleanupNativeAudioRecording(true);
            sendNativeAudioResult(callbackId, false, "", "", message);
        }
    }

    private String readNativeAudioBase64() throws Exception {
        if (nativeAudioFile == null || !nativeAudioFile.exists() || nativeAudioFile.length() <= 0) {
            return "";
        }
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        FileInputStream input = new FileInputStream(nativeAudioFile);
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) {
            output.write(buffer, 0, count);
        }
        input.close();
        return Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
    }

    private void cleanupNativeAudioRecording(boolean deleteFile) {
        if (nativeAudioRecorder != null) {
            try {
                nativeAudioRecorder.release();
            } catch (Exception ignored) {
                // Best effort cleanup.
            }
        }
        nativeAudioRecorder = null;
        if (deleteFile && nativeAudioFile != null && nativeAudioFile.exists()) {
            nativeAudioFile.delete();
        }
        nativeAudioFile = null;
    }

    private void startDeviceCredentialUnlock(String callbackId) {
        KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (keyguardManager == null || !keyguardManager.isDeviceSecure()) {
            sendSecurityResult(callbackId, false, "Device lock is not set up.");
            return;
        }

        Intent intent = keyguardManager.createConfirmDeviceCredentialIntent("Unlock Health & Task Tracker", "Use your phone lock to continue.");
        if (intent == null) {
            sendSecurityResult(callbackId, false, "Device unlock is not available.");
            return;
        }

        pendingCredentialCallbackId = callbackId;
        startActivityForResult(intent, DEVICE_CREDENTIAL_REQUEST);
    }

    private class SecurityBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return isDeviceSecure();
        }

        @JavascriptInterface
        public void authenticate(String callbackId) {
            runOnUiThread(() -> {
                if (!isDeviceSecure()) {
                    sendSecurityResult(callbackId, false, "Set up a phone lock first.");
                    return;
                }

                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
                    startDeviceCredentialUnlock(callbackId);
                    return;
                }

                BiometricPrompt.Builder builder = new BiometricPrompt.Builder(MainActivity.this)
                        .setTitle("Unlock Health & Task Tracker")
                        .setSubtitle("Use your phone unlock to continue.");

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    builder.setDeviceCredentialAllowed(true);
                } else {
                    builder.setNegativeButton("Use password", getMainExecutor(), (dialog, which) -> startDeviceCredentialUnlock(callbackId));
                }

                try {
                    builder.build().authenticate(new CancellationSignal(), getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            sendSecurityResult(callbackId, true, "");
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                            if (errorCode == BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED
                                    || errorCode == BiometricPrompt.BIOMETRIC_ERROR_CANCELED) {
                                sendSecurityResult(callbackId, false, String.valueOf(errString));
                                return;
                            }
                            startDeviceCredentialUnlock(callbackId);
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            // Let the system prompt keep listening after a bad scan.
                        }
                    });
                } catch (Exception exception) {
                    startDeviceCredentialUnlock(callbackId);
                }
            });
        }
    }

    private class DictationBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return SpeechRecognizer.isRecognitionAvailable(MainActivity.this);
        }

        @JavascriptInterface
        public void start(String callbackId) {
            runOnUiThread(() -> {
                if (!hasAudioPermission()) {
                    pendingPermissionSpeechCallbackId = callbackId;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_REQUEST);
                    }
                    return;
                }

                beginLongDictation(callbackId);
            });
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(() -> {
                if (activeSpeechCallbackId == null) {
                    return;
                }
                speechManuallyStopping = true;
                appendPartialSpeechResult();
                if (speechRecognizer != null) {
                    try {
                        speechRecognizer.stopListening();
                    } catch (Exception exception) {
                        finishLongDictation(true, "");
                    }
                } else {
                    finishLongDictation(true, "");
                }
            });
        }
    }

    private class AudioRecorderBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return true;
        }

        @JavascriptInterface
        public void start(String callbackId) {
            runOnUiThread(() -> {
                if (!hasAudioPermission()) {
                    pendingPermissionAudioCallbackId = callbackId;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_REQUEST);
                    }
                    return;
                }

                beginNativeAudioRecording(callbackId);
            });
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(() -> {
                if (activeAudioCallbackId == null) {
                    return;
                }
                finishNativeAudioRecording();
            });
        }
    }

    private class KeyboardBridge {
        @JavascriptInterface
        public void show() {
            runOnUiThread(() -> {
                if (MainActivity.this.bridge == null) {
                    return;
                }

                WebView webView = MainActivity.this.bridge.getWebView();
                if (webView == null) {
                    return;
                }

                webView.requestFocus(View.FOCUS_DOWN);
                InputMethodManager inputMethodManager = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                if (inputMethodManager != null) {
                    inputMethodManager.showSoftInput(webView, InputMethodManager.SHOW_FORCED);
                }
            });
        }
    }

    private class NotificationBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return true;
        }

        @JavascriptInterface
        public boolean hasPermission() {
            return hasNotificationPermission();
        }

        @JavascriptInterface
        public void requestPermission() {
            runOnUiThread(() -> requestNotificationPermissionIfNeeded());
        }

        @JavascriptInterface
        public void notify(String title, String body, String tag) {
            runOnUiThread(() -> showNativeNotification(title, body, tag));
        }
    }

    private class PrintBridge {
        @JavascriptInterface
        public void printHtml(String html, String jobName) {
            runOnUiThread(() -> {
                printWebView = new WebView(MainActivity.this);
                printWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        if (printManager == null) {
                            return;
                        }

                        String safeJobName = jobName == null || jobName.trim().isEmpty()
                                ? "To-do list"
                                : jobName.trim();
                        PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(safeJobName);
                        printManager.print(safeJobName, adapter, new PrintAttributes.Builder().build());
                    }
                });
                printWebView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            });
        }
    }
}
