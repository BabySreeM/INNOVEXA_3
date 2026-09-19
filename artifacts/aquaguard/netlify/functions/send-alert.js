// Netlify Serverless Function for Twilio WhatsApp Dispatch
// Path: netlify/functions/send-alert.js

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { phone, message } = JSON.parse(event.body || '{}');

    const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC79cbb6f8e5c59cead3550cd3e4b85fa2';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '6e1fd92a22df576d143f108931a055c7';
    const fromNumber = process.env.TWILIO_FROM_NUMBER || '+14155238886';
    const toNumber = phone || '+916369056400';

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const fromFormatted = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
    const toFormatted = toNumber.startsWith('whatsapp:') ? toNumber : `whatsapp:${toNumber.startsWith('+') ? toNumber : '+' + toNumber}`;

    const params = new URLSearchParams();
    params.append('From', fromFormatted);
    params.append('To', toFormatted);
    params.append('Body', message || '🚨 INNOVEXA AUTOMATED SAFETY ALERT');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (res.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'WhatsApp message sent via Twilio Netlify Function!' }),
      };
    } else {
      const errText = await res.text();
      return {
        statusCode: res.status,
        body: JSON.stringify({ success: false, error: errText }),
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
