package org.vigilance.oryxdashboard

import android.os.Bundle
import androidx.activity.ComponentActivity
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import org.vigilance.oryxdashboard.api.backend

class MainActivity : ComponentActivity() {

    ////////////////////////////////////////////////////////////////////////////////////////////////
    override fun onCreate(savedInstanceState: Bundle?) {

        super.onCreate(savedInstanceState)
        setContentView(R.layout.mainactivity)

        if(!Python.isStarted()){
            Python.start(AndroidPlatform(this))
        }

        val logic = backend()
        logic.talk()
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////
}