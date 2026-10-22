package com.demo.androidtodo

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotificationTuningModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  private val manager: NotificationManager
    get() = reactContext.getSystemService(NotificationManager::class.java)

  /**
   * A channel's sound is only honoured at the moment it is created: an app cannot change it afterwards
   * (verified on HyperOS — setSound + createNotificationChannel on an existing channel is a no-op), and
   * expo can only hand it an android.resource:// uri, which HyperOS cannot resolve through the system
   * media library and therefore mutes. So this has to run *before* expo touches the same id.
   */
  @ReactMethod
  fun ensureChannel(channelId: String, name: String, description: String, importance: Int, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(null)
      return
    }
    val ringtone = RingtoneManager.getActualDefaultRingtoneUri(reactContext, RingtoneManager.TYPE_NOTIFICATION)
    val existing = manager.getNotificationChannel(channelId)
    val current = existing?.sound
    // A sound the user picked in Settings shows up as a media-library uri we never wrote, so anything
    // other than our own two shapes counts as their choice and is left alone. Sound cannot be patched
    // after a channel exists, so an app-owned channel has to be deleted and rebuilt to change it.
    val appOwned = current == null ||
      current == Settings.System.DEFAULT_NOTIFICATION_URI ||
      current.toString().startsWith("android.resource://${reactContext.packageName}/")
    var recreated = false
    if (existing != null && appOwned && current != ringtone) {
      manager.deleteNotificationChannel(channelId)
      recreated = true
    }
    if (recreated || manager.getNotificationChannel(channelId) == null) {
      // expo's MAX maps to 5, which the platform constructor rejects; the audible ceiling is HIGH(4).
      val channel = NotificationChannel(channelId, name, importance.coerceIn(1, 4))
      channel.description = description
      if (ringtone != null) {
        // Attributes bind at creation like the sound does. Left null, the platform falls back to a legacy
        // stream and HyperOS routes the tone through the media volume group, so muting media or plugging
        // in headphones silences the alarm; 696 of the 705 channels on this device declare the pair below.
        channel.setSound(
          ringtone,
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
      }
      manager.createNotificationChannel(channel)
    }
    val result = Arguments.createMap()
    result.putString("ringtone", ringtone?.toString())
    result.putString("channel", manager.getNotificationChannel(channelId)?.sound?.toString())
    result.putBoolean("recreated", recreated)
    promise.resolve(result)
  }

  @ReactMethod
  fun openChannelSettings(channelId: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.reject("E_UNSUPPORTED", "这个系统版本没有通知渠道")
      return
    }
    val channelIntent = Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
      .putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
      .putExtra(Settings.EXTRA_CHANNEL_ID, channelId)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val appIntent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
      .putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    // 澎湃可能根本没实现单渠道那一页，所以叫不开就退到应用通知总页，两处都叫不开才让 JS 弹兜底提示。
    val opened = if (start(channelIntent)) "channel" else if (start(appIntent)) "app" else null
    if (opened == null) {
      promise.reject("E_NO_SETTINGS", "系统设置里没有可跳转的通知页")
    } else {
      promise.resolve(opened)
    }
  }

  private fun start(intent: Intent): Boolean = try {
    reactContext.startActivity(intent)
    true
  } catch (error: Exception) {
    false
  }

  companion object {
    const val NAME = "NotificationTuning"
  }
}
