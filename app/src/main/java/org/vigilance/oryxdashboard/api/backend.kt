package org.vigilance.oryxdashboard.api

import com.google.ai.client.generativeai.GenerativeModel
import kotlinx.coroutines.runBlocking

class backend {

    val chatbot = GenerativeModel(modelName ="gemini-1.5-flash", apiKey ="AIzaSyBm3r77twsjtbSoCzqdE6VEkBUYF6aRMx8")

    fun talk() = runBlocking{
        val response = chatbot.generateContent("Hello Gemini").text
        print(response)
    }
}