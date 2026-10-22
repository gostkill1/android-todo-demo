package com.demo.androidtodo

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class SystemCalendarPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = when (name) {
    SystemCalendarModule.NAME -> SystemCalendarModule(reactContext)
    NotificationTuningModule.NAME -> NotificationTuningModule(reactContext)
    else -> null
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        SystemCalendarModule.NAME to
          ReactModuleInfo(
            SystemCalendarModule.NAME,
            SystemCalendarModule::class.java.name,
            false,
            false,
            false,
            false,
          ),
        NotificationTuningModule.NAME to
          ReactModuleInfo(
            NotificationTuningModule.NAME,
            NotificationTuningModule::class.java.name,
            false,
            false,
            false,
            false,
          )
      )
    }
}
