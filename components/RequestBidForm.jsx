'use client';

import { useState } from 'react';

export default function RequestBidForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    setSuccessMessage('');
    setErrorMessage('');
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const params = new URLSearchParams(window.location.search);

    const payload = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      company: String(formData.get('company') || '').trim(),
      project_type: String(formData.get('project_type') || '').trim(),
      project_location: String(formData.get('project_location') || '').trim(),
      message: String(formData.get('message') || '').trim(),
      page_url: window.location.href,
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_content: params.get('utm_content') || '',
      utm_term: params.get('utm_term') || '',
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorMessage(data?.error || 'Unable to submit your request right now. Please try again.');
        return;
      }

      setSuccessMessage('Request received. Our team will follow up shortly.');
      form.reset();
    } catch {
      setErrorMessage('Unable to submit your request right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="bid-form" action="/api/contact" method="post" noValidate onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label" htmlFor="name">
          First &amp; Last Name
        </label>
        <input className="form-input" type="text" id="name" name="name" placeholder="Jordan Mercer" required />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="email">
          Email
        </label>
        <input className="form-input" type="email" id="email" name="email" placeholder="jordan@company.com" />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="phone">
          Phone
        </label>
        <input className="form-input" type="tel" id="phone" name="phone" placeholder="(555) 000-0000" />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="company">
          Company
        </label>
        <input className="form-input" type="text" id="company" name="company" placeholder="Vulpine Builders" />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="type">
          Project Type
        </label>
        <select className="form-select" id="type" name="project_type" required>
          <option value="">Select a project type</option>
          <option value="multifamily">Multifamily / Apartment</option>
          <option value="single-family">Single-Family Renovation</option>
          <option value="investor-flip">Investor Flip / Rental Refresh</option>
          <option value="new-build">New Build</option>
          <option value="contractor">Contractor Supply Relationship</option>
        </select>
      </div>
      <div className="form-group full">
        <label className="form-label" htmlFor="project_location">
          Project Location
        </label>
        <input
          className="form-input"
          type="text"
          id="project_location"
          name="project_location"
          placeholder="City, community, or property address"
        />
      </div>
      <div className="form-group full">
        <label className="form-label" htmlFor="message">
          Project Details
        </label>
        <textarea
          className="form-textarea"
          id="message"
          name="message"
          placeholder="Tell us about unit count, materials needed, location, and schedule."
          required
        ></textarea>
      </div>
      <button type="submit" className="form-submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send Request'}
      </button>
      <div aria-live="polite" role="status">
        {successMessage ? <p className="section-body">{successMessage}</p> : null}
        {errorMessage ? <p className="section-body">{errorMessage}</p> : null}
      </div>
    </form>
  );
}
