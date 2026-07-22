export const FOLLOW_UP_TEMPLATE_KEYS = ['subscribe', 'not_a_fit', 'answers'] as const;

export type FollowUpTemplateKey = (typeof FOLLOW_UP_TEMPLATE_KEYS)[number];

export interface FollowUpTemplate {
  key: FollowUpTemplateKey;
  label: string;
  description: string;
  subject: string;
  body: string;
}

interface TemplateContext {
  leadName: string;
  agentName: string;
}

function firstName(name: string, fallback: string) {
  return name.trim().split(/\s+/)[0] || fallback;
}

export function getFollowUpTemplates({ leadName, agentName }: TemplateContext): FollowUpTemplate[] {
  const lead = firstName(leadName, 'there');
  const agent = firstName(agentName, 'The RevFactor team');

  return [
    {
      key: 'subscribe',
      label: 'Subscribe follow-up',
      description: 'Send the agreement and onboarding next step.',
      subject: 'Your next step with RevFactor',
      body: `Hi ${lead},

Thank you for taking the time to speak with us today. Based on our conversation, the next step is to begin your RevFactor setup.

Start here: https://onboarding.revfactor.io/start

You will confirm your service details, sign the agreement, complete payment, and receive access to your RevFactor portal. The portal will then guide you through the property, software, and pricing information our team needs.

Please reply to this email if anything comes up along the way.

Best,
${agent}
RevFactor`,
    },
    {
      key: 'not_a_fit',
      label: 'Not a fit',
      description: 'Close the conversation clearly and respectfully.',
      subject: 'Thank you for speaking with RevFactor',
      body: `Hi ${lead},

Thank you for taking the time to speak with us today and for sharing more about your property.

Based on what we discussed, RevFactor does not appear to be the right fit for your needs at this time. We would rather be transparent than recommend a service that is not well matched to your current goals.

We appreciate the conversation and wish you the best with the property.

Best,
${agent}
RevFactor`,
    },
    {
      key: 'answers',
      label: 'Answers to follow',
      description: 'Acknowledge open questions and set the next expectation.',
      subject: 'Following up on your RevFactor questions',
      body: `Hi ${lead},

Thank you for speaking with us today. A few questions came up that I want to confirm with the team before giving you a final answer.

Questions to follow up on:
• [Add the first question or topic]
• [Add another question or remove this line]

I will follow up as soon as I have the details. In the meantime, feel free to reply with anything else you would like us to include.

Best,
${agent}
RevFactor`,
    },
  ];
}

export function isFollowUpTemplateKey(value: unknown): value is FollowUpTemplateKey {
  return typeof value === 'string' && FOLLOW_UP_TEMPLATE_KEYS.includes(value as FollowUpTemplateKey);
}
