# AI Reliability

## Goal

Make AI transcription and IELTS evaluation measurable, debuggable, and consistent.

## Improvements

1. Track AI metadata for each test result.
   - Transcription model
   - Evaluation model
   - Prompt version
   - Latency
   - Token usage if available
   - Provider name

2. Add prompt versioning.
   - Store prompts in named files or constants
   - Save the prompt version with every result
   - Keep old versions for comparison

3. Add JSON repair and retry logic.
   - Retry once when the model returns malformed JSON
   - Validate every response with Zod
   - Return clear errors if parsing fails

4. Add calibration samples.
   - Store sample transcripts with expected score ranges
   - Run them before changing prompts
   - Compare score drift after model or prompt updates

## Resume Value

This turns the project from a simple AI wrapper into an AI product with evaluation discipline, observability, and model governance.
