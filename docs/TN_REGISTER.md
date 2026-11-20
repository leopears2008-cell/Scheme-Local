# Tamil Nadu department register (SAHAYAK)

Source: `backend/data/sources/tn_department_register.csv` (72 scheme names, 8 departments, source checked 2026-11-18).

Status of every row: **NAME_LISTED_DETAILS_PENDING**. The names come from official listings, but eligibility, benefits,
documents, application steps and current operational status have NOT been verified yet.

What the site does with these rows:
- Shows the scheme name, department and official source link.
- Shows "Details pending official verification" instead of eligibility or benefits.
- Never marks them eligible and never invents criteria.

To make a row real: open its official source link, copy the eligibility, benefits, documents and application route,
record the date you checked, and have a named reviewer mark it verified in the admin dashboard (which requires an official https source).
