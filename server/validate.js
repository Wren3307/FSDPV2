const INTERESTS = ['adult', 'child', 'family', 'private', 'other'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{8,20}$/;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** Returns { errors, values }. `errors` maps a field name to a message the visitor can act on. */
export function validateEnquiry(body = {}) {
  const values = {
    name: text(body.name),
    email: text(body.email),
    phone: text(body.phone),
    interest: text(body.interest),
    dojo: text(body.dojo),
    message: text(body.message),
  };
  const errors = {};

  if (!values.name) errors.name = 'Enter your name.';
  else if (values.name.length > 100) errors.name = 'Shorten your name to 100 characters or fewer.';

  if (!values.email) errors.email = 'Enter your email address.';
  else if (values.email.length > 200 || !EMAIL.test(values.email)) errors.email = 'Enter an email address like name@example.com.';

  if (values.phone && !PHONE.test(values.phone)) errors.phone = 'Enter a phone number with at least 8 digits, or leave this blank.';

  if (!INTERESTS.includes(values.interest)) errors.interest = 'Choose who the classes are for.';

  if (values.dojo.length > 120) errors.dojo = 'Choose a dojo from the list.';

  if (values.message.length > 2000) errors.message = 'Shorten your message to 2,000 characters or fewer.';

  if (body.consent !== true) errors.consent = 'Tick the box so we can use your details to reply.';

  return { errors, values };
}
