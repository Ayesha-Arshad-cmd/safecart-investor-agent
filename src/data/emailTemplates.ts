/**
 * The model emails the agent copies when it writes outreach (one for investors, one for fundraising experts).
 * The AI keeps the same structure, facts and terms, and adds ONE specific sentence about each person.
 * To change the offer to experts (fee, equity), edit EXPERT_TERMS below — nothing else needs to change.
 */

/** Bump when the templates change: unsent emails written with an older version are rewritten before auto-sending. */
export const TEMPLATE_V = 2;

export const EXPERT_TERMS = {
  successFee: '5%',
  equity: 'up to 0.5%'
};

export const INVESTOR_MODEL_EMAIL = `Hi Lars,
What if the future of e-commerce were built not just around what people buy, but around protecting the families who buy it?
I'm Mohammad Hanafi, founder of SafeCartKids, an AI-powered, family-focused e-commerce platform designed to give children a safe shopping experience while empowering parents to control purchasing decisions.
Today, traditional e-commerce platforms are designed primarily for adults, leaving parents with limited control over their children's product discovery, online shopping, and spending. SafeCartKids addresses this gap through AI-powered product filtering, parental purchase approvals, spending limits, age-appropriate recommendations, and educational engagement.
Our vision is to build "The Next Amazon for Families" — a trusted digital commerce ecosystem that combines child safety, responsible purchasing, and AI-powered personalization with a scalable business model.
We see an opportunity to build more than a parental-control tool: a new family-focused commerce platform designed around the needs of both parents and children.
I'm currently connecting with a select group of pre-seed investors and strategic partners who recognize the potential of AI-powered consumer platforms and underserved markets.
Given your investment interests and experience, I'd welcome the opportunity to introduce SafeCartKids, share our vision, and explore whether there could be a fit.
Would you be open to a brief 15-minute conversation?

Thank you for your time and consideration.
Best regards,
Mohammad Hanafi
Founder, SafeCartKids`;

export const INVESTOR_RULES = `Email 1 MUST follow the MODEL INVESTOR EMAIL closely — same order, tone and length (180-260 words):
1. Greeting with their first name.
2. The one-line hook question about the future of e-commerce protecting families.
3. "I'm <founder>, founder of <company>, …" one-sentence description.
4. The problem paragraph (e-commerce built for adults, parents have limited control).
5. How <company> solves it — use only features from the startup profile.
6. The vision line ("The Next Amazon for Families") and the "more than a parental-control tool" line.
7. "I'm currently connecting with a select group of pre-seed investors and strategic partners …".
8. ONE specific sentence about THIS investor taken from the evidence (a portfolio company, a sector they focus on, or something they said) — this shows we chose them deliberately. Never invent it; if the evidence has nothing specific, refer to their stated focus.
9. The ask: "Would you be open to a brief 15-minute conversation?"
10. "Thank you for your time and consideration." then "Best regards," <sender name>, "Founder, <company>".
Subject: short, specific, no hype (e.g. "SafeCartKids — family-focused commerce, pre-seed").`;

export const EXPERT_MODEL_EMAIL = `Subject: Fundraising Partnership Opportunity — SafeCartKids

I'm Mohammad Hanafi, founder of SafeCartKids, an AI-powered e-commerce platform designed to make online shopping safer for children while giving parents control over purchasing decisions.
We are seeking an experienced fundraising professional to help us secure pre-seed investment and build relationships with qualified angel investors, venture capital firms, and strategic partners.
We offer a performance-based compensation structure:
5% success fee on qualifying investment funds successfully secured and received by the company through your efforts.
No upfront fees, retainers, or advance payments.
Up to 0.5% equity as an additional incentive, subject to agreed fundraising milestones, continued contribution, and formal documentation.
We are looking for someone with a verifiable track record in early-stage startup fundraising, strong investor relationships, and a long-term interest in helping build a potentially significant family-focused technology company.
If you have relevant experience and are interested in a results-based partnership, please share your fundraising track record, examples of successful raises, and proposed approach.
Let's explore whether we can build a successful partnership.
Mohammad Hanafi
Founder, SafeCartKids`;

export const expertRules = () => `Email 1 MUST follow the MODEL EXPERT EMAIL closely — same order and the SAME TERMS, word for word where possible:
1. Subject EXACTLY: "Fundraising Partnership Opportunity — <company>".
2. Greeting with their first name, then "I'm <founder>, founder of <company>, …" one-sentence description.
3. ONE specific sentence about THIS person from the evidence (a raise they helped with, a client, their specialty) — never invent it.
4. "We are seeking an experienced fundraising professional to help us secure pre-seed investment and build relationships with qualified angel investors, venture capital firms, and strategic partners."
5. The performance-based compensation, exactly these terms and nothing more:
   - ${EXPERT_TERMS.successFee} success fee on qualifying investment funds successfully secured and received by the company through their efforts.
   - No upfront fees, retainers, or advance payments.
   - ${EXPERT_TERMS.equity} equity as an additional incentive, subject to agreed fundraising milestones, continued contribution, and formal documentation.
6. What we look for: a verifiable track record in early-stage startup fundraising, strong investor relationships, long-term interest.
7. The ask: please share your fundraising track record, examples of successful raises, and proposed approach.
8. "Let's explore whether we can build a successful partnership." then <sender name>, "Founder, <company>".
Never offer any other fee, retainer, salary or payment.`;
