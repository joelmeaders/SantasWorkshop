# Remote Config production setup evidence

Completed on **2026-09-07** for project **`santas-workshop-193b5`**
(project number **`397997267986`**). This setup used the existing production
IAM policy and preserved unrelated bindings. This prerequisite step did not
deploy code. The later successful production deployments are recorded in the
[deployed QA report](remote-config-deployed-qa.md).

## Remote Config publication

The production Remote Config template and the legacy Firestore source were
read immediately before publication. The source document name was
`projects/santas-workshop-193b5/databases/(default)/documents/parameters/public`.
Its update time was `2026-01-01T23:34:17.538668Z`, which matched the reviewed
candidate provenance. Remote Config was version **51** with ETag
`etag-397997267986-51`; the template had no managed public-parameters
parameter, conditions, or parameter groups.

The freshly prepared candidate matched the tracked production candidate by
canonical SHA-256:

`cbc15235986e3a99bc371c2fcb43ba7c5901dfafcb97c9c340784f3c8056fd5d`

The candidate was published with `If-Match: etag-397997267986-51`. The
publication created version **52** with ETag **`etag-397997267986-52`**. A
fresh GET and `verify-public-parameters.cjs` confirmed one unconditional JSON
`santashop_public_parameters` parameter, with no conditions or groups. The
published settings preserve `registrationEnabled: false` and
`maintenanceModeEnabled: true`.

The legacy Firestore document was read only and was not changed.

## Identities and IAM

These dedicated service accounts were created and verified enabled:

| Account                                                                 | Direct project roles                                                          |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `remote-config-reader@santas-workshop-193b5.iam.gserviceaccount.com`    | `roles/cloudconfig.viewer`, `roles/datastore.user`, `roles/logging.logWriter` |
| `remote-config-publisher@santas-workshop-193b5.iam.gserviceaccount.com` | `roles/cloudconfig.admin`, `roles/logging.logWriter`                          |

The reader has an unconditional `roles/storage.objectUser` binding on
`gs://santas-workshop-193b5.appspot.com`, as required by the release readiness
check for registration object access.

The existing CI deployment identity
`github-action-298411435@santas-workshop-193b5.iam.gserviceaccount.com` has
`roles/iam.serviceAccountUser` on each dedicated account individually. It also
has the same scoped binding on
`santas-workshop-193b5@appspot.gserviceaccount.com`, the production App Engine
default service account required by the existing Functions deployment path.

No service-account keys were created. Authentication used an ephemeral gcloud
access token; no token was written to this document or the evidence files.

## API and preflight validation

The required Remote Config, Remote Config Realtime, IAM, Service Usage, Cloud
Functions, and Cloud Run APIs are enabled. The production preflight command

```text
node scripts/remote-config-readiness.cjs --project santas-workshop-193b5 --preflight
```

completed with exit code 0. It reported **60** template reads per minute and a
required release threshold of **60**, with no problems. This is identity,
quota, and template preflight evidence. It does not prove gateway deployment,
consumer deployment, application delivery, or production browser acceptance.

Redacted setup evidence is retained under the ignored
`.tmp-remote-config/prod-prereq-20260907T201203Z/` directory, including the
fresh comparison, publication result, final IAM summary, post-publication
snapshot, and preflight output.
