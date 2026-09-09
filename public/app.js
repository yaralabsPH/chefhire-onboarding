(() => {
  const form = document.getElementById('onboardingForm');
  const steps = [...document.querySelectorAll('.form-step')];
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const submitBtn = document.getElementById('submitBtn');
  const stepLabel = document.getElementById('stepLabel');
  const progressPercent = document.getElementById('progressPercent');
  const progressBar = document.getElementById('progressBar');
  const formError = document.getElementById('formError');
  const successState = document.getElementById('successState');

  let currentStep = 1;
  const totalSteps = steps.length;

  const requiredGroups = {
    3: ['services', 'sources'],
    4: ['bookingDetails', 'followupChannels'],
    5: ['integrations']
  };

  function updateUI() {
    steps.forEach(step => step.classList.toggle('active', Number(step.dataset.step) === currentStep));

    const percent = Math.round((currentStep / totalSteps) * 100);
    stepLabel.textContent = `Step ${currentStep} of ${totalSteps}`;
    progressPercent.textContent = `${percent}%`;
    progressBar.style.width = `${percent}%`;

    prevBtn.hidden = currentStep === 1;
    nextBtn.hidden = currentStep === totalSteps;
    submitBtn.hidden = currentStep !== totalSteps;

    formError.hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getChecked(name) {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(el => el.value);
  }

  function validateStep(stepNum) {
    let ok = true;
    formError.hidden = true;

    const step = steps.find(el => Number(el.dataset.step) === stepNum);
    const fields = [...step.querySelectorAll('input[required], textarea[required], select[required]')];

    fields.forEach(field => {
      if (field.type === 'radio') return;
      field.classList.remove('invalid');

      if (!field.checkValidity()) {
        field.classList.add('invalid');
        ok = false;
      }
    });

    const radios = [...step.querySelectorAll('input[type="radio"][required]')];
    const radioNames = [...new Set(radios.map(r => r.name))];
    radioNames.forEach(name => {
      if (!getChecked(name).length) ok = false;
    });

    (requiredGroups[stepNum] || []).forEach(name => {
      const error = form.querySelector(`[data-error-for="${name}"]`);
      if (!getChecked(name).length) {
        if (error) error.textContent = 'Please select at least one option.';
        ok = false;
      } else if (error) {
        error.textContent = '';
      }
    });

    if (!ok) {
      formError.textContent = 'Please complete the required fields before continuing.';
      formError.hidden = false;
      const firstInvalid = step.querySelector('.invalid');
      if (firstInvalid) firstInvalid.focus();
    }

    return ok;
  }

  nextBtn.addEventListener('click', () => {
    if (!validateStep(currentStep)) return;
    currentStep += 1;
    updateUI();
  });

  prevBtn.addEventListener('click', () => {
    currentStep -= 1;
    updateUI();
  });

  form.addEventListener('input', event => {
    if (event.target.classList?.contains('invalid')) {
      event.target.classList.remove('invalid');
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validateStep(currentStep)) return;

    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    formError.hidden = true;

    const data = new FormData(form);
    const submissionId = `CH-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const payload = {
      submissionId,
      website: data.get('website') || '',
      businessName: data.get('businessName') || '',
      abn: data.get('abn') || '',
      businessAddress: data.get('businessAddress') || '',
      primaryContact: data.get('primaryContact') || '',
      email: data.get('email') || '',
      phone: data.get('phone') || '',
      ghlUsers: data.get('ghlUsers') || '',
      operatingCoverage: data.get('operatingCoverage') || '',
      services: getChecked('services'),
      sources: getChecked('sources'),
      process: data.get('process') || '',
      bookingDetails: getChecked('bookingDetails'),
      followupChannels: getChecked('followupChannels'),
      firstResponseTime: data.get('firstResponseTime') || '',
      customerComms: data.get('customerComms') || '',
      currentData: data.get('currentData') || '',
      integrations: getChecked('integrations'),
      candidateRecruitment: data.get('candidateRecruitment') || '',
      additionalNotes: data.get('additionalNotes') || '',
      submittedAt: new Date().toISOString()
    };

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Submission failed');
      }

      form.hidden = true;
      successState.hidden = false;
      document.querySelector('.progress-wrap').hidden = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error(error);
      formError.textContent = 'We could not submit the form. Please try again, or contact CJ if the problem continues.';
      formError.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
    }
  });

  updateUI();
})();
