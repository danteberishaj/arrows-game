using UnityEngine;

namespace Arrows
{
    /// <summary>
    /// Plays simple UI sound effects. The clips are synthesized in code (short sine
    /// blips with an exponential decay) so the project ships with no audio files.
    /// </summary>
    public class AudioManager : MonoBehaviour
    {
        private AudioSource _source;
        private AudioClip _success;
        private AudioClip _fail;
        private AudioClip _win;

        public void Init()
        {
            _source = gameObject.AddComponent<AudioSource>();
            _source.playOnAwake = false;

            _success = MakeBlip(880f, 0.12f);              // bright high blip
            _fail = MakeBlip(160f, 0.18f, square: true);   // low buzzy thud
            _win = MakeArpeggio(new[] { 523f, 659f, 784f, 1046f }, 0.1f); // C-E-G-C
        }

        public void PlaySuccess() => _source.PlayOneShot(_success);
        public void PlayFail() => _source.PlayOneShot(_fail);
        public void PlayWin() => _source.PlayOneShot(_win);

        private static AudioClip MakeBlip(float freq, float duration, bool square = false)
        {
            int rate = 44100;
            int samples = Mathf.CeilToInt(rate * duration);
            var data = new float[samples];
            for (int i = 0; i < samples; i++)
            {
                float t = i / (float)rate;
                float env = Mathf.Exp(-t * 12f);             // decay
                float wave = Mathf.Sin(2f * Mathf.PI * freq * t);
                if (square) wave = Mathf.Sign(wave);
                data[i] = wave * env * 0.5f;
            }
            var clip = AudioClip.Create("blip", samples, 1, rate, false);
            clip.SetData(data, 0);
            return clip;
        }

        private static AudioClip MakeArpeggio(float[] freqs, float noteLen)
        {
            int rate = 44100;
            int perNote = Mathf.CeilToInt(rate * noteLen);
            int samples = perNote * freqs.Length;
            var data = new float[samples];
            for (int n = 0; n < freqs.Length; n++)
            {
                for (int i = 0; i < perNote; i++)
                {
                    float t = i / (float)rate;
                    float env = Mathf.Exp(-t * 6f);
                    data[n * perNote + i] = Mathf.Sin(2f * Mathf.PI * freqs[n] * t) * env * 0.45f;
                }
            }
            var clip = AudioClip.Create("arp", samples, 1, rate, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
