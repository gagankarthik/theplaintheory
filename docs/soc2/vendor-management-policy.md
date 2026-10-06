# Vendor management policy

| | |
| --- | --- |
| Owner | Security lead `[owner]` |
| Review | Annually |
| Criteria | CC9.2, CC3.4 |

## Before onboarding a vendor

Anyone proposing a vendor that will store, process or access customer data, source code or
production systems must get Security lead approval first. The review covers:

1. what data the vendor gets, and whether we can minimise it;
2. its security attestations (a SOC 2 Type II or ISO 27001 report less than 12 months old), or a
   completed security questionnaire if it has none;
3. a data processing agreement with GDPR standard contractual clauses where data leaves the EEA, and
   DPDP-compliant terms;
4. breach notification terms short enough for us to meet our 72-hour obligations;
5. how to get our data back and have it deleted when we leave.

New subprocessors of customer personal data are announced to customers before use, as the customer
DPA requires.

## Register

| Vendor | Purpose | Data | Region | Attestation | Criticality |
| --- | --- | --- | --- | --- | --- |
| Amazon Web Services | Hosting: DynamoDB, S3, CloudFront, Cognito, KMS, Lambda | All customer data, encrypted with our KMS keys | Customer-selected: ap-south-1, ap-south-2, eu-central-1, us-east-1 | SOC 2 Type II, ISO 27001 | Critical |
| Stripe | Billing | Billing contact, organization id; no consent data | US / EU | SOC 2 Type II, PCI DSS Level 1 | High |
| GitHub | Source code, CI | Source code; no customer data | US | SOC 2 Type II | High |
| Google Workspace | Email, documents | Staff email; customer support correspondence | Global | SOC 2 Type II, ISO 27001 | Medium |

Keep this table current. Any change also updates the public subprocessor list.

## Annual review

Each year, for every vendor: get the latest attestation and read its exceptions and complementary
user entity controls (CUECs); confirm we operate the CUECs (for example, MFA on our AWS root and IAM
Identity Center); check access is still needed; and record the outcome. Off-board unused vendors and
confirm deletion of our data.
