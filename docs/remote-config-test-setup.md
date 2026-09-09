# Remote Config test setup evidence

**Current status:** the private gateway resolved the quota blocker,
and test and production deployments completed. See
[the current release design](remote-config.md) and
[deployed QA evidence](remote-config-deployed-qa.md). The original setup and
provider rejection below are historical evidence; no quota increase occurred.

The initial setup checkpoint was **2026-09-07 at 16:49 UTC**, for
**`santas-workshop-test` only** (project number `312672416598`). At that point,
setup was complete except for the template-read quota.

## Published configuration

The current Firestore source and Remote Config version 40 were read again before
publication. The resulting candidate matched the previously reviewed
`remote-config/migration/santas-workshop-test.template.json` exactly. Its SHA-256
was `abe06b77768428257d7ac7d5cf5a2eed2ba37aea8ab0747415061aad676625e9`.

- REST validation returned HTTP 200.
- Publication used `If-Match: etag-312672416598-40`, never a wildcard.
- Publication returned **version 41**, ETag **`etag-312672416598-41`**.
- A separate GET and `verifyPublicParameters` confirmed the published settings.
  A deep comparison confirmed all candidate parameters, including the existing
  `message` and `maintenanceModeEnabled` parameters, were preserved.
- The initial comparison reported a property-order difference. A semantic deep
  comparison and fresh GET passed; no repeat publication was performed.
- The legacy Firestore document was not modified. Its source update time was
  `2026-09-02T05:57:38.940034Z`.

The published JSON preserves the reviewed test operating settings. It adds a
disabled empty global alert for the field absent from the legacy test document.

## Identities and API access

Created these dedicated service accounts and verified both remain enabled:

| Account in `santas-workshop-test.iam.gserviceaccount.com` | Direct project roles                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `remote-config-reader`                                    | `roles/cloudconfig.viewer`, `roles/datastore.user`, `roles/logging.logWriter` |
| `remote-config-publisher`                                 | `roles/cloudconfig.admin`, `roles/logging.logWriter`                          |

The reader also has an unconditional `roles/storage.objectUser` binding on
`santas-workshop-test.appspot.com`. Project and bucket policy changes preserved
existing bindings and used current policy ETags.

The existing deployment principal,
`github-action-298411435@santas-workshop-test.iam.gserviceaccount.com`, received
`roles/iam.serviceAccountUser` on each new account individually. Cloud Functions
UpdateFunction audit records from September 6 confirmed this is the deployed
GitHub Actions identity. Its existing Firebase Admin role contains the template,
project-policy, bucket-policy, and quota read permissions used by the readiness
check; no additional broad project role was added to it.

Remote Config and Remote Config Realtime APIs were already enabled. IAM and
Cloud Quotas APIs were enabled for setup. A final service listing verified all
four APIs are enabled. No service-account keys were created. Authentication
used an ephemeral gcloud access token and tokens were not retained in evidence.

## Remaining release gate

`node scripts/remote-config-readiness.cjs --project santas-workshop-test`
returned exit 1 with exactly one problem:

```text
Template-read quota is 60/minute; at least 600/minute is required before release.
```

Cloud Quotas identifies the quota as
`ReadRemoteConfigPerMinutePerProject`, with increase eligibility
`ineligibilityReason: NOT_SUPPORTED`. A single supported API request for 600
reads/minute was attempted using `projects.locations.quotaPreferences.create`.
It returned **HTTP 400, FAILED_PRECONDITION**, with the reason
**`Unsupported service firebaseremoteconfig.googleapis.com`**. A final list of
quota preferences returned an empty result. No increase request was accepted or
left pending, and the effective allocation remains 60/minute.

The 600/minute gate remains in place. A supported provider escalation or a
separately approved design change is needed before this gate can pass. See the
[Cloud Quotas create API](https://docs.cloud.google.com/docs/quotas/reference/rest/v1/projects.locations.quotaPreferences/create)
and [test project quota console](https://console.cloud.google.com/iam-admin/quotas?project=santas-workshop-test).

At the initial checkpoint, deployment, real-time latency, failure recovery,
load behavior and rollback were unverified. Subsequent deployments used GitHub
Actions; current evidence and remaining limits are in the deployed QA report.

Local raw setup responses are retained under the ignored
`.tmp-remote-config/test-setup-*` files for this workstation's audit trail. This
document contains the portable evidence summary for review.

## App Check alternate-origin QA repair

On **2026-09-07 at 20:28 UTC**, the existing test reCAPTCHA Enterprise key
(`dscs-test`) was read before the change. Its domain enforcement was enabled
(`allowAllDomains: false`) and it allowed the three existing hosts:
`santas-workshop-test.web.app`, `santashop-app-test.web.app`, and
`test.denversantaclausshop.org`.

The test allowlist was updated with the verified `gcloud recaptcha keys update`
web flags (`--web --domains=...`) to preserve those three hosts and add only
`santas-workshop-test.firebaseapp.com`. A fresh readback now shows exactly
those four hosts. `allowAllDomains` remains false; the integration remains
score-based; no other key setting changed. The public site key value is omitted
from this evidence. Chrome subsequently loaded the protected owner settings
page on the corrected hostname.

Verified command shape (key identifier redacted):

```text
gcloud recaptcha keys update <test-key-id> --project=santas-workshop-test --web --domains="santas-workshop-test.web.app,santashop-app-test.web.app,test.denversantaclausshop.org,santas-workshop-test.firebaseapp.com"
```

The production project was inspected read-only. Its `dscs-prod` key currently
allows `register.denversantaclausshop.org`, `admin.denversantaclausshop.org`,
`santas-workshop-admin.web.app`, and `test.denversantaclausshop.org`, with
`allowAllDomains: false`. Production deployment should keep its customer and
admin origins within that set; any future Firebase default host used by either
app requires a separate production allowlist review. The production key was
not changed.
