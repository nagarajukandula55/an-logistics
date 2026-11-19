# Pincode coordinate refresh

The coordinate refresh uses the Department of Posts dataset published through the Government of India Open Government Data portal (`data.gov.in`). It only fills records where both `latitude` and `longitude` are missing; existing coordinates are retained.

Configure one of these options in the repository's GitHub Actions secrets:

- `PINCODE_GEO_SOURCE_URL`: a direct JSON/GeoJSON download URL for the official Department of Posts OGD resource; or
- `PINCODE_DATA_GOV_API_KEY` and `PINCODE_DATA_GOV_RESOURCE_ID`: the API credentials and resource ID for the official OGD pincode directory containing latitude and longitude.

The scheduled workflow runs every Monday at 08:00 IST and can also be started manually from Actions. It commits only actual directory or coordinate additions to `main`. It does not delete pincode records, overwrite existing coordinates, or change rate data.
