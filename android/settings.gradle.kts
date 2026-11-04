pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

rootProject.name = "BluetoothStayAlive"
include(":app")

apply(from = "capacitor.settings.gradle")
