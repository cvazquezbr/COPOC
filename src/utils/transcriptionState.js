import fetchWithAuth from './fetchWithAuth';
import { toast } from 'sonner';

export const getTranscriptions = async () => {
  const res = await fetchWithAuth('/api/transcriptions');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch transcriptions.');
  }
  return res.json();
};

export const saveTranscription = async (name, videoUrl, briefingId, transcriptionData) => {
  try {
    const requestBody = JSON.stringify({
      name,
      video_url: videoUrl,
      briefing_id: briefingId,
      transcription_data: transcriptionData,
    });

    const createRes = await fetchWithAuth('/api/transcriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });

    if (!createRes.ok) {
      const errorBody = await createRes.text();
      throw new Error(`Failed to create transcription. Server says: ${errorBody}`);
    }

    const result = await createRes.json();
    return result;
  } catch (error) {
    toast.error(`Save failed: ${error.message}`);
    throw error;
  }
};

export const updateTranscription = async (id, name, videoUrl, briefingId, transcriptionData) => {
    try {
        const requestBody = JSON.stringify({
          name,
          video_url: videoUrl,
          briefing_id: briefingId,
          transcription_data: transcriptionData,
        });

        const res = await fetchWithAuth(`/api/transcriptions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody,
        });

        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`Failed to update transcription. Server says: ${errorBody}`);
        }

        const result = await res.json();
        return result;
    } catch (error) {
        toast.error(`Update failed: ${error.message}`);
        throw error;
    }
};

export const deleteTranscription = async (id) => {
    try {
        const res = await fetchWithAuth(`/api/transcriptions/${id}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to delete transcription.');
        }
        return res.json();
    } catch (error) {
        toast.error(`Delete failed: ${error.message}`);
        throw error;
    }
};
