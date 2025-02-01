import google.generativeai as gen


class chatbot:

    ################################################################################################
    def __init__(self):
        gen.configure(api_key="AIzaSyBm3r77twsjtbSoCzqdE6VEkBUYF6aRMx8")
        self.model = gen.GenerativeModel("gemini-1.5-flash")
    ################################################################################################
    def converse(self, prompt):
        response = self.model.generate_content(prompt)
        if response:
            return str(response.text)
        else:
            return "<ResponseError> No Response from API"
    ################################################################################################
bot = chatbot()