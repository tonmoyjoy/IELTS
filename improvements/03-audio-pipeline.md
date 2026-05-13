# Audio Pipeline

## Goal

Make audio upload, transcription, and scoring reliable for real users.

## Improvements

1. Validate audio before sending it to Gemini.
   - Maximum file size
   - Minimum duration
   - Maximum duration
   - Allowed MIME types
   - Empty or corrupted blob handling

2. Add recording playback before submission.
   - Let users listen to their recording
   - Allow re-recording before upload
   - Show file size and duration

3. Move long-running analysis to background jobs.
   - Create an exam attempt record first
   - Process transcription and evaluation asynchronously
   - Poll or stream job status to the dashboard

4. Add storage support.
   - Store audio in object storage
   - Save only signed URLs or storage keys in MongoDB
   - Add retention rules for privacy

## Resume Value

This demonstrates real system design: validation, async processing, storage, and user-friendly long-running workflows.
