@echo off
rem RN 0.86 / Expo 57 要求：compileSdk 36、build-tools 36.0.0、NDK 27.1.12297006
setlocal
rem 下面两行改成本机实际路径；JAVA_HOME 指向任意 JDK 17
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
call "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="%ANDROID_HOME%" --install "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006"
