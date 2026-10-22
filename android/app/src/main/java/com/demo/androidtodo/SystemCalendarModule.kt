package com.demo.androidtodo

import android.content.ActivityNotFoundException
import android.content.Intent
import android.provider.CalendarContract
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SystemCalendarModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /**
   * resolve(true) only means the calendar's create-event sheet opened. The system UI hands back no
   * result, so whether the event was actually written is unknowable from here.
   */
  @ReactMethod
  fun openCreateEvent(
    title: String?,
    description: String?,
    beginTime: Double,
    endTime: Double,
    promise: Promise
  ) {
    val intent = Intent(Intent.ACTION_INSERT)
      .setDataAndType(CalendarContract.Events.CONTENT_URI, "vnd.android.cursor.item/event")
      .putExtra(CalendarContract.Events.TITLE, title.orEmpty())
      .putExtra(CalendarContract.Events.DESCRIPTION, description.orEmpty())
      .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, beginTime.toLong())
      .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, endTime.toLong())

    val activity = reactContext.currentActivity
    if (activity == null) {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    try {
      (activity ?: reactContext).startActivity(intent)
      promise.resolve(true)
    } catch (error: ActivityNotFoundException) {
      promise.reject("E_NO_CALENDAR", error.message, error)
    }
  }

  companion object {
    const val NAME = "SystemCalendar"
  }
}
