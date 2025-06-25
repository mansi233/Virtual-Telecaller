import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.http import MediaIoBaseDownload
import io
import time

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend integration

# === OpenAI API Configuration ===
token = os.getenv("OPENAI_API_KEY") 
endpoint = "https://models.inference.ai.azure.com"
model_name = "gpt-4o"

client = OpenAI(
    base_url=endpoint,
    api_key=token,
)

# === Google Drive Configuration ===
SERVICE_ACCOUNT_FILE = 'PATH_TO_YOUR_SERVICE_FILE'
FILE_TO_UPLOAD = 'queries.txt'
YOUR_EMAIL = 'your email'
FOLDER_ID = 'YOUR_FOLDER_ID'
MIMETYPE = 'text/plain'

# Initialize Drive Service
SCOPES = ['https://www.googleapis.com/auth/drive']
credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
drive_service = build('drive', 'v3', credentials=credentials)

def handle_drive_upload():
    """Handles the file upload/update to Google Drive"""
    # Check if file exists in folder
    query = f"'{FOLDER_ID}' in parents and name='{FILE_TO_UPLOAD}' and trashed = false"
    response = drive_service.files().list(
        q=query, 
        spaces='drive', 
        fields='files(id, name)'
    ).execute()
    files = response.get('files', [])

    media = MediaFileUpload(FILE_TO_UPLOAD, mimetype=MIMETYPE)

    if files:
        # File exists - update it
        file_id = files[0]['id']
        drive_service.files().update(
            fileId=file_id,
            media_body=media
        ).execute()
        print(f"✅ File updated! File ID: {file_id}")
    else:
        # File doesn't exist - create new
        file_metadata = {'name': FILE_TO_UPLOAD, 'parents': [FOLDER_ID]}
        file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        file_id = file.get('id')
        print(f"✅ File uploaded! File ID: {file_id}")

    # Share with your email
    drive_service.permissions().create(
        fileId=file_id,
        body={
            'type': 'user',
            'role': 'reader',
            'emailAddress': YOUR_EMAIL
        },
        fields='id'
    ).execute()

    # Get shareable link
    file_info = drive_service.files().get(
        fileId=file_id, 
        fields='webViewLink'
    ).execute()

    return {
        'file_id': file_id,
        'file_link': file_info.get('webViewLink')
    }

@app.route("/ai-chat", methods=["POST"])
def ai_chat():
    """Endpoint for OpenAI chat completions"""
    try:
        data = request.json
        user_message = data.get("message")

        if not user_message:
            return jsonify({"error": "Message is required"}), 400

        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": user_message},
            ],
            temperature=1.0,
            top_p=1.0,
            max_tokens=1000,
            model=model_name,
        )

        return jsonify({"response": response.choices[0].message.content})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/speech-chat', methods=['POST'])
def speech_chat():
    """Endpoint that handles speech text, uploads to Drive, and fetches response"""
    try:
        data = request.json
        message = data.get('message', '').strip()
        
        if not message:
            return jsonify({'error': 'No message provided'}), 400

        # 1. Save the recognized text (overwrite mode)
        with open(FILE_TO_UPLOAD, 'w', encoding='utf-8') as f:
            f.write(message)  # No newline to keep clean content

        # 2. Upload to Google Drive
        drive_response = handle_drive_upload()
        
        # 3. Wait for response to be generated (5 seconds)
        time.sleep(5)
        
        # 4. Fetch and read response.txt from Drive
        response_content = fetch_and_read_response()
        
        return jsonify({
            'status': 'success',
            'recognized_text': message,
            'drive_file_id': drive_response['file_id'],
            'drive_link': drive_response['file_link'],
            'tts_response': response_content  # This goes to text-to-speech
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def fetch_and_read_response():
    """Fetches response.txt from Drive and returns its content"""
    try:
        # Search for response file
        query = f"'{FOLDER_ID}' in parents and name='response.txt' and trashed=false"
        results = drive_service.files().list(q=query, fields="files(id)").execute()
        
        if not results.get('files'):
            return None

        # Download file content directly to memory
        file_id = results['files'][0]['id']
        request = drive_service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        
        done = False
        while not done:
            _, done = downloader.next_chunk()
        
        # Get content as string
        response_text = fh.getvalue().decode('utf-8').strip()
        print(f"Fetched response content: {response_text[:50]}...")  # Log first 50 chars
        
        return response_text if response_text else None
        
    except Exception as e:
        print(f"Error fetching response: {str(e)}")
        return None
# @app.route('/speech-chat', methods=['POST'])
# def speech_chat():
#     """Endpoint that receives recognized speech, saves to file, and uploads to Google Drive"""
#     try:
#         data = request.json
#         message = data.get('message', '').strip()
        
#         if not message:
#             return jsonify({'error': 'No message provided'}), 400

#         # Write to queries.txt (append mode)
#         with open(FILE_TO_UPLOAD, 'w', encoding='utf-8') as f:
#             f.write(f"{message}\n")

#         # Upload/update to Google Drive
#         drive_response = handle_drive_upload()
        
#         return jsonify({
#             'status': 'success',
#             'message': 'Text saved and uploaded to Google Drive',
#             'content': message,
#             'drive_file_id': drive_response['file_id'],
#             'drive_link': drive_response['file_link']
#         }), 200

#     except Exception as e:
#         return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Create empty file if it doesn't exist
    if not os.path.exists(FILE_TO_UPLOAD):
        with open(FILE_TO_UPLOAD, 'w') as f:
            pass
            
    app.run(debug=True)


# import os
# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from openai import OpenAI

# app = Flask(__name__)
# CORS(app)  # Enable CORS for frontend integration

# # OpenAI API Configuration
# token = "GITHUB_TOKEN"  # Note: This appears to be a GitHub token, not OpenAI
# endpoint = "https://models.inference.ai.azure.com"
# model_name = "gpt-4o"

# client = OpenAI(
#     base_url=endpoint,
#     api_key=token,
# )

# @app.route("/ai-chat", methods=["POST"])
# def ai_chat():
#     """Endpoint for OpenAI chat completions"""
#     try:
#         data = request.json
#         user_message = data.get("message")

#         if not user_message:
#             return jsonify({"error": "Message is required"}), 400

#         response = client.chat.completions.create(
#             messages=[
#                 {"role": "system", "content": "You are a helpful assistant."},
#                 {"role": "user", "content": user_message},
#             ],
#             temperature=1.0,
#             top_p=1.0,
#             max_tokens=1000,
#             model=model_name,
#         )

#         return jsonify({"response": response.choices[0].message.content})

#     except Exception as e:
#         return jsonify({"error": str(e)}), 500



# if __name__ == '__main__':
#     app.run(debug=True)
