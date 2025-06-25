from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# === CONFIGURATION ===

SERVICE_ACCOUNT_FILE = 'YOUR_SERVICE_FILE_PATH'
FILE_TO_UPLOAD = 'queries.txt'                      # File to upload
YOUR_EMAIL = 'YOUR_EMAIL_ID'       # Your Google email
MIMETYPE = 'text/plain'                             # Change if uploading other types (e.g., 'application/pdf')
FOLDER_ID = 'YOUR_FOLDER_ID'      # Folder ID to upload into

# === AUTHENTICATION ===

SCOPES = ['https://www.googleapis.com/auth/drive']
credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)
drive_service = build('drive', 'v3', credentials=credentials)

# === CHECK IF FILE EXISTS IN FOLDER ===

query = f"'{FOLDER_ID}' in parents and name='{FILE_TO_UPLOAD}' and trashed = false"
response = drive_service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
files = response.get('files', [])

media = MediaFileUpload(FILE_TO_UPLOAD, mimetype=MIMETYPE)

if files:
    # === FILE EXISTS — UPDATE IT ===
    file_id = files[0]['id']
    drive_service.files().update(
        fileId=file_id,
        media_body=media
    ).execute()
    print(f"✅ File updated! File ID: {file_id}")
else:
    # === FILE DOESN'T EXIST — CREATE NEW ===
    file_metadata = {'name': FILE_TO_UPLOAD, 'parents': [FOLDER_ID]}
    file = drive_service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id'
    ).execute()
    file_id = file.get('id')
    print(f"✅ File uploaded! File ID: {file_id}")

# === SHARE WITH YOUR EMAIL ===

drive_service.permissions().create(
    fileId=file_id,
    body={
        'type': 'user',
        'role': 'reader',
        'emailAddress': YOUR_EMAIL
    },
    fields='id'
).execute()

# === GET SHAREABLE LINK ===

file_info = drive_service.files().get(fileId=file_id, fields='webViewLink').execute()
print(f"🔗 File link: {file_info.get('webViewLink')}")
