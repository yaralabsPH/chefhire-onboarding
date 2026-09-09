/**
 * ChefHire CRM onboarding backend
 *
 * Deploy as a Google Apps Script Web App:
 * - Execute as: Me
 * - Who has access: Anyone
 *
 * Then set Script Properties:
 * FORM_SHARED_SECRET = same value used in Cloudflare Pages
 * SPREADSHEET_ID = destination Google Sheet ID
 * NOTIFY_EMAIL = notification recipient
 * SHEET_NAME = optional, defaults to Responses
 */

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty('SPREADSHEET_ID');
  const notifyEmail = props.getProperty('NOTIFY_EMAIL');

  if (!spreadsheetId) throw new Error('Missing Script Property: SPREADSHEET_ID');
  if (!notifyEmail) throw new Error('Missing Script Property: NOTIFY_EMAIL');

  return {
    SPREADSHEET_ID: spreadsheetId,
    SHEET_NAME: props.getProperty('SHEET_NAME') || 'Responses',
    NOTIFY_EMAIL: notifyEmail,
    SHEET_URL: 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit'
  };
}

const HEADERS = [
  'Submission Timestamp',
  'Business Name',
  'ABN / ACN',
  'Business Address',
  'Primary Contact',
  'Primary Contact Email',
  'Primary Contact Phone',
  'GHL Users / Alert Recipients',
  'Operating Coverage',
  'Services GHL Should Manage',
  'Lead / Enquiry Sources',
  'Enquiry → Booking Process',
  'Booking Details to Capture',
  'Preferred Follow-up Channels',
  'Target First-response Time',
  'Customer-facing Email / Phone',
  'Current Data + Migration Needs',
  'Integrations / Tools to Connect',
  'Manage Chef/Candidate Recruitment in GHL?',
  'Additional Notes',
  'Form Submission ID',
  'CRM Setup Status',
  'CJ Notes'
];

function doGet() {
  return json_({ ok: true, service: 'ChefHire onboarding backend' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);

    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'Missing request body.' });
    }

    const data = JSON.parse(e.postData.contents);
    const expectedSecret = PropertiesService.getScriptProperties().getProperty('FORM_SHARED_SECRET');

    if (!expectedSecret || data._secret !== expectedSecret) {
      return json_({ ok: false, error: 'Unauthorized.' });
    }

    if (data.website) {
      return json_({ ok: true, submissionId: data.submissionId || '' });
    }

    validate_(data);

    const config = getConfig_();
    const spreadsheet = SpreadsheetApp.openById(config.SPREADSHEET_ID);
    let sheet = spreadsheet.getSheetByName(config.SHEET_NAME);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(config.SHEET_NAME);
    }

    ensureHeaders_(sheet);

    const submittedAt = data.submittedAt
      ? new Date(data.submittedAt)
      : new Date();

    const row = [
      submittedAt,
      clean_(data.businessName),
      clean_(data.abn),
      clean_(data.businessAddress),
      clean_(data.primaryContact),
      clean_(data.email),
      clean_(data.phone),
      clean_(data.ghlUsers),
      clean_(data.operatingCoverage),
      list_(data.services),
      list_(data.sources),
      clean_(data.process),
      list_(data.bookingDetails),
      list_(data.followupChannels),
      clean_(data.firstResponseTime),
      clean_(data.customerComms),
      clean_(data.currentData),
      list_(data.integrations),
      clean_(data.candidateRecruitment),
      clean_(data.additionalNotes),
      clean_(data.submissionId),
      'New',
      ''
    ];

    sheet.appendRow(row);

    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    SpreadsheetApp.flush();

    const emailWarning = sendNotification_(data, lastRow, config);

    return json_({
      ok: true,
      submissionId: data.submissionId || '',
      row: lastRow,
      emailWarning: emailWarning || null
    });

  } catch (error) {
    console.error(error);
    return json_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function validate_(data) {
  const required = [
    'businessName', 'businessAddress', 'primaryContact', 'email', 'phone',
    'ghlUsers', 'operatingCoverage', 'process', 'firstResponseTime',
    'customerComms', 'currentData', 'candidateRecruitment'
  ];

  required.forEach(function(key) {
    if (!String(data[key] || '').trim()) {
      throw new Error('Missing required field: ' + key);
    }
  });

  ['services', 'sources', 'bookingDetails', 'followupChannels', 'integrations']
    .forEach(function(key) {
      if (!Array.isArray(data[key]) || data[key].length === 0) {
        throw new Error('Missing required selection: ' + key);
      }
    });
}

function ensureHeaders_(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  const isEmpty = current.every(function(value) { return !value; });

  if (isEmpty) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function sendNotification_(data, rowNumber, config) {
  const subject = 'ChefHire onboarding submitted — ' + clean_(data.businessName);

  const body = [
    'A new ChefHire CRM onboarding form has been submitted.',
    '',
    'Business: ' + clean_(data.businessName),
    'Primary contact: ' + clean_(data.primaryContact),
    'Email: ' + clean_(data.email),
    'Phone: ' + clean_(data.phone),
    'Submission ID: ' + clean_(data.submissionId),
    'Sheet row: ' + rowNumber,
    '',
    'Open responses:',
    config.SHEET_URL
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;color:#1c1c1c">
      <div style="border-left:4px solid #d8912e;padding-left:16px;margin-bottom:22px">
        <div style="font-size:12px;color:#9a6318;font-weight:bold;text-transform:uppercase;letter-spacing:.08em">ChefHire</div>
        <h2 style="margin:5px 0 0">New CRM onboarding submission</h2>
      </div>
      <p>A new onboarding form has been submitted and saved to your Google Sheet.</p>
      <table cellpadding="7" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px">
        ${rowHtml_('Business', data.businessName)}
        ${rowHtml_('Primary contact', data.primaryContact)}
        ${rowHtml_('Email', data.email)}
        ${rowHtml_('Phone', data.phone)}
        ${rowHtml_('Services', list_(data.services))}
        ${rowHtml_('First response target', data.firstResponseTime)}
        ${rowHtml_('Candidate recruitment', data.candidateRecruitment)}
        ${rowHtml_('Submission ID', data.submissionId)}
      </table>
      <p style="margin-top:22px">
        <a href="${config.SHEET_URL}" style="display:inline-block;background:#1d1c1a;color:#fff;text-decoration:none;padding:11px 16px;border-radius:7px;font-weight:bold">
          Open onboarding responses
        </a>
      </p>
    </div>`;

  try {
    GmailApp.sendEmail(config.NOTIFY_EMAIL, subject, body, {
      htmlBody: html,
      name: 'ChefHire Onboarding'
    });
    return '';
  } catch (error) {
    console.error('Email notification failed:', error);
    return String(error && error.message ? error.message : error);
  }
}

function rowHtml_(label, value) {
  return `
    <tr>
      <td style="border-bottom:1px solid #ece8df;color:#6b6a66;width:180px;vertical-align:top">${escapeHtml_(label)}</td>
      <td style="border-bottom:1px solid #ece8df;font-weight:600">${escapeHtml_(clean_(value))}</td>
    </tr>`;
}

function clean_(value) {
  return String(value == null ? '' : value).trim();
}

function list_(value) {
  return Array.isArray(value) ? value.join(', ') : clean_(value);
}

function escapeHtml_(value) {
  return clean_(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
