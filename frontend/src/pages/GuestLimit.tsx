/** Shown to guests on features that need a real account. Says plainly what is and is not possible. */
export default function GuestLimit({ feature }: { feature: string }) {
  return (
    <section className="card" role="region" aria-label={`${feature} requires account`}>
      <h3>{feature} needs an account</h3>
      <p className="small">You are using SchemeLocal as a guest. Guests can browse schemes, check eligibility and chat.
      {" "}Saved records, uploads and {feature} are only available after signing in with your mobile number.</p>
      <p className="small muted">Your guest session ends when you close this tab.</p>
    </section>
  );
}
