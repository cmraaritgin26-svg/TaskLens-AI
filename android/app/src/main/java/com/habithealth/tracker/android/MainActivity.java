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
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import android.view.inputmethod.InputMethodManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int DEVICE_CREDENTIAL_REQUEST = 4217;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 4220;
    private static final String REMINDER_CHANNEL_ID = "health_task_tracker_reminders";
    private static final String CRISIS_CHANNEL_ID = "health_task_tracker_crisis_alerts";
    private static final long[] CRISIS_VIBRATION_PATTERN = new long[]{0, 900, 250, 900, 250, 1200, 350, 1200};
    private WebView printWebView;
    private String pendingCredentialCallbackId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWebViewPrivacy();
        registerPrintBridge();
        registerSecurityBridge();
        registerKeyboardBridge();
        registerNotificationBridge();
        handleFacebookRedirect(getIntent());
    }

    private void configureWebViewPrivacy() {
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
