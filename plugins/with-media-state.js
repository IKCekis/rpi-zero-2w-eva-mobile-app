/**
 * Expo Config Plugin — adds a minimal Kotlin native module that lets JS query
 * Android's AudioManager.isMusicActive() without any special permissions.
 *
 * Run:  npx expo prebuild  (or npx expo run:android)
 * to regenerate android/ with this module included.
 */
const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

// ── Kotlin source files ───────────────────────────────────────────────────────

const MODULE_KT = `
package com.eva.mobile

import android.content.Context
import android.media.AudioManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class MediaStateModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "MediaState"

    @ReactMethod
    fun isMusicActive(promise: Promise) {
        try {
            val am = reactApplicationContext
                .getSystemService(Context.AUDIO_SERVICE) as AudioManager
            promise.resolve(am.isMusicActive)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
`.trimStart();

const PACKAGE_KT = `
package com.eva.mobile

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class MediaStatePackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(MediaStateModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`.trimStart();

// ── Plugin implementation ─────────────────────────────────────────────────────

function withMediaStateFiles(config) {
    return withDangerousMod(config, ['android', async (config) => {
        const pkgDir = path.join(
            config.modRequest.platformProjectRoot,
            'app/src/main/java/com/eva/mobile',
        );
        fs.mkdirSync(pkgDir, { recursive: true });
        fs.writeFileSync(path.join(pkgDir, 'MediaStateModule.kt'), MODULE_KT);
        fs.writeFileSync(path.join(pkgDir, 'MediaStatePackage.kt'), PACKAGE_KT);
        return config;
    }]);
}

function withMediaStateRegistration(config) {
    return withDangerousMod(config, ['android', async (config) => {
        const appPath = path.join(
            config.modRequest.platformProjectRoot,
            'app/src/main/java/com/eva/mobile/MainApplication.kt',
        );
        if (!fs.existsSync(appPath)) return config;
        let src = fs.readFileSync(appPath, 'utf8');
        if (src.includes('MediaStatePackage')) return config; // idempotent
        // Inject into getPackages apply block
        src = src.replace(
            /PackageList\(this\)\.packages\.apply\s*\{/,
            'PackageList(this).packages.apply {\n                add(MediaStatePackage())',
        );
        fs.writeFileSync(appPath, src);
        return config;
    }]);
}

module.exports = (config) => {
    config = withMediaStateFiles(config);
    config = withMediaStateRegistration(config);
    return config;
};
