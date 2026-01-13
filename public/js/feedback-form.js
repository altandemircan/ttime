(function() {
  const form = document.getElementById('feedback-form');
  if (!form) return;
  const statusEl = document.getElementById('feedback-status');

  function setStatus(msg, type = 'info') {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'feedback-status ' + type;
  }

  async function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(file);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = form.message.value.trim();
    const type = form.type.value;
    const userEmail = form.userEmail.value.trim();
    const file = form.screenshot.files[0];

    if (!message) {
      setStatus('Message cannot be empty', 'error');
      return;
    }

    let screenshot = null;
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit example
        setStatus('Image exceeds 2MB limit', 'error');
        return;
      }
      try {
        screenshot = await fileToDataURL(file); // data:image/...;base64,...
      } catch (err) {
        setStatus('Could not read image', 'error');
        return;
      }
    }

    const payload = {
      message,
      type,
      userEmail: userEmail || null,
      screenshot
    };

    setStatus('Sending...', 'info');

    try {
      const resp = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });

      let data = {};
      try { data = await resp.json(); } catch(_) {}

      if (!resp.ok) {
        setStatus('Error: ' + (data.error || resp.status), 'error');
        console.error('Feedback error', resp.status, data);
        return;
      }

      setStatus(
  `Thank you! Your feedback has been submitted successfully.
  Every idea, suggestion, and issue report is carefully reviewed by our team.
  If you included an email, we may reach out for clarification or follow-up.
  Your input directly helps us prioritize improvements and create a better experience.
  We sincerely appreciate your support.`,
  'success'
);
form.classList.add('feedback-form-sent');
      form.reset();
    } catch (err) {
      console.error(err);
      setStatus('Network error', 'error');
    }
  });

  // Cancel button (close sidebar if present)
  const cancelBtn = document.getElementById('feedback-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      form.reset();
      setStatus('');
      if (typeof toggleSidebarFeedback === 'function') {
        toggleSidebarFeedback();
      }
    });
  }
})();