package com.songloft.iwebplayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class MediaReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        MainActivity activity = MainActivity.instance;
        if (activity == null) return;
        String action = intent.getAction() == null ? "" : intent.getAction();
        switch (action) {
            case "play":
                activity.runJs("(function(){var a=document.getElementById('audio');if(a)a.play().catch(function(){})})()");
                break;
            case "pause":
                activity.runJs("(function(){var a=document.getElementById('audio');if(a)a.pause()})()");
                break;
            case "next":
                activity.runJs("(function(){var b=document.getElementById('btn-next');if(b)b.click()})()");
                break;
            case "prev":
                activity.runJs("(function(){var b=document.getElementById('btn-prev');if(b)b.click()})()");
                break;
            default:
                break;
        }
    }
}
