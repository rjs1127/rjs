package hs.rjs.syungbook;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    @PluginMethod
    public void install(PluginCall call) {
        String rawPath = call.getString("path");

        if (rawPath == null || rawPath.trim().isEmpty()) {
            call.reject("APK 경로가 없습니다.", "APK_PATH_MISSING");
            return;
        }

        try {
            String normalizedPath = rawPath.trim();

            if (normalizedPath.startsWith("file://")) {
                Uri fileUri = Uri.parse(normalizedPath);
                normalizedPath = fileUri.getPath();
            }

            if (normalizedPath == null || normalizedPath.isEmpty()) {
                call.reject("APK 경로를 확인할 수 없습니다.", "APK_PATH_INVALID");
                return;
            }

            File apkFile = new File(normalizedPath);

            if (!apkFile.exists() || !apkFile.isFile()) {
                call.reject("다운로드한 APK 파일을 찾을 수 없습니다.", "APK_NOT_FOUND");
                return;
            }

            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apkFile
            );

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject(
                "APK 설치 화면을 열지 못했습니다.",
                "APK_INSTALL_OPEN_FAILED",
                error
            );
        }
    }
}
