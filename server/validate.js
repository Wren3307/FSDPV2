const INTERESTS = ['adult', 'child', 'family', 'private', 'other'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{8,20}$/;
export const MIN_PASSWORD = 10;

export const RANKS = [
  'Ungraded',
  ...['10th', '9th', '8th', '7th', '6th', '5th', '4th', '3rd', '2nd', '1st'].map((n) => `${n} Kyu`),
  ...['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map((n) => `${n} Dan`),
];

const text = (value) => (typeof value === 'string' ? value.trim() : '');

function checkName(name, errors) {
  if (!name) errors.name = 'Enter your name.';
  else if (name.length > 100) errors.name = 'Shorten your name to 100 characters or fewer.';
}

function checkEmail(email, errors) {
  if (!email) errors.email = 'Enter your email address.';
  else if (email.length > 200 || !EMAIL.test(email)) errors.email = 'Enter an email address like name@example.com.';
}

function checkPhone(phone, errors, required) {
  if (!phone) {
    if (required) errors.phone = 'Enter a phone number so your dojo can reach you.';
  } else if (!PHONE.test(phone)) {
    errors.phone = 'Enter a phone number with at least 8 digits.';
  }
}

export function checkNewPassword(password, errors, field = 'password') {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    errors[field] = `Use at least ${MIN_PASSWORD} characters.`;
  } else if (password.length > 200) {
    errors[field] = 'Use 200 characters or fewer.';
  }
}

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
  checkName(values.name, errors);
  checkEmail(values.email, errors);
  checkPhone(values.phone, errors, false);
  if (!INTERESTS.includes(values.interest)) errors.interest = 'Choose who the classes are for.';
  if (values.dojo.length > 120) errors.dojo = 'Choose a dojo from the list.';
  if (values.message.length > 2000) errors.message = 'Shorten your message to 2,000 characters or fewer.';
  if (body.consent !== true) errors.consent = 'Tick the box so we can use your details to reply.';
  return { errors, values };
}

export function validateSignup(body = {}, dojoNames) {
  const values = {
    name: text(body.name),
    email: text(body.email).toLowerCase(),
    phone: text(body.phone),
    dojo: text(body.dojo),
  };
  const errors = {};
  checkName(values.name, errors);
  checkEmail(values.email, errors);
  checkPhone(values.phone, errors, true);
  checkNewPassword(body.password, errors);
  if (!dojoNames.has(values.dojo)) errors.dojo = 'Choose the dojo where you will train.';
  if (body.terms !== true) errors.terms = 'Tick the box to accept the membership terms.';
  return { errors, values: { ...values, password: body.password } };
}

export function validateProfile(body = {}, dojoNames, { requireDojo }) {
  const values = { name: text(body.name), phone: text(body.phone), dojo: text(body.dojo) };
  const errors = {};
  checkName(values.name, errors);
  checkPhone(values.phone, errors, requireDojo);
  if (requireDojo ? !dojoNames.has(values.dojo) : values.dojo && !dojoNames.has(values.dojo)) {
    errors.dojo = 'Choose your Principal Dojo from the list.';
  }
  return { errors, values };
}

export function validateInstructor(body = {}, dojoNames) {
  const values = {
    name: text(body.name),
    email: text(body.email).toLowerCase(),
    phone: text(body.phone),
    dojos: Array.isArray(body.dojos) ? [...new Set(body.dojos.map(text))] : [],
  };
  const errors = {};
  checkName(values.name, errors);
  checkEmail(values.email, errors);
  checkPhone(values.phone, errors, false);
  checkNewPassword(body.password, errors);
  if (values.dojos.length === 0) errors.dojos = 'Choose at least one dojo this instructor teaches at.';
  else if (values.dojos.some((d) => !dojoNames.has(d))) errors.dojos = 'Choose dojos from the list.';
  return { errors, values: { ...values, password: body.password } };
}

export const hasErrors = (errors) => Object.keys(errors).length > 0;
