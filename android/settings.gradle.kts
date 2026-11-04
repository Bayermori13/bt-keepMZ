pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "BluetoothStayAlive"
include(":app")

include(":capacitor-android")
project(":capacitor-android").projectDir = java.io.File(rootProject.projectDir, "../node_modules/@capacitor/android/capacitor")
