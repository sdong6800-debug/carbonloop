"""Reproducible, pinned EU-ECB import. No source notebooks are executed.
Only a public-field allowlist is emitted; contact information is not retained.
"""
import csv
import hashlib
import io
import json
import math
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

COMMIT = '212528e231f4ce506f2973bd40643434ee9de777'
REPO = 'https://github.com/mroeck/Embodied-Carbon-of-European-Buildings-Database'
BASE = REPO.replace('github.com', 'raw.githubusercontent.com') + '/' + COMMIT + '/'
FEATURE = '00_data/3_data_feature_engineered/EU-ECB_dataset_feature_engineered.csv'
ORIGINAL = '00_data/2_data_concatenated/EU-ECB_dataset_concatenated.csv'

def download(path):
    data = urllib.request.urlopen(BASE + path, timeout=40).read()
    return list(csv.DictReader(io.StringIO(data.decode('utf-8-sig')))), hashlib.sha256(data).hexdigest()

def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (ValueError, TypeError):
        return None

def main():
    featured, fh = download(FEATURE)
    original, oh = download(ORIGINAL)
    # Source identity must be unambiguous. Repeated project codes are not silently deduplicated.
    by_id = defaultdict(list)
    for i, row in enumerate(original):
        by_id[(row['admin_project_code'], row['site_country'])].append((i + 2, row))
    counts = Counter(r['admin_project_code'] for r in featured)
    fields = ['admin_project_code', 'site_country', 'bldg_use_type', 'bldg_use_subtype',
              'bldg_project_status', 'bldg_area_definition', 'bldg_area_gfa', 'bldg_area_interval',
              'bldg_floors_ag', 'bldg_struct_type', 'lca_RSP', 'lca_database', 'lca_software',
              'lca_scenarios_decarbonisation', 'scope_parts', 'scope_LCS', 'scope_LCM', 'scope_handling_D']
    fields += [k for k in featured[0] if k.startswith('scope_parts_') or k.startswith('scope_LCS_')]
    rows = []
    for i, f in enumerate(featured):
        matches = by_id[(f['admin_project_code'], f['site_country'])]
        src_line, src = matches[0] if len(matches) == 1 else (None, {})
        record = {k: f.get(k, '') for k in fields}
        record.update(row_id=f'EU-{i+1:04}', source_line=i+2, evidence_line=src_line,
                      duplicate_code=counts[f['admin_project_code']] > 1)
        record['evidence_context'] = {k: src.get(k, '') for k in ['bldg_area_gfa', 'lca_RSP']}
        record['reported'] = {k: number(v) for k, v in src.items()
                              if k.startswith('GHG_') and '_APEN' not in k and '_P' not in k}
        record['featured'] = {k: number(v) for k, v in f.items()
                              if k.startswith('GHG_') and k.endswith('_m2a') and '_P' not in k}
        rows.append(record)
    meta = dict(dataset='EU-ECB-DB', authors='Martin Röck and Andreas Sorensen', year=2022,
                commit=COMMIT, retrieved_at=datetime.now(timezone.utc).isoformat(),
                repository=REPO, feature_path=FEATURE, evidence_path=ORIGINAL,
                source_url=REPO+'/blob/'+COMMIT+'/'+FEATURE,
                evidence_url=REPO+'/blob/'+COMMIT+'/'+ORIGINAL,
                doi='https://doi.org/10.5281/zenodo.6671558',
                reports=['https://doi.org/10.5281/zenodo.6120522','https://doi.org/10.5281/zenodo.5895051'],
                license='CC BY-SA 4.0', license_url='https://creativecommons.org/licenses/by-sa/4.0/',
                feature_sha256=fh, evidence_sha256=oh, records=len(rows),
                unique_project_codes=len(counts), source_columns=len(featured[0]),
                changes='Public-field subset; source-row IDs added; non-numeric values normalized to null; unambiguous linkage to concatenated data for complete-stage evidence. No contact fields retained.',
                unit='kg CO2e/m2/year')
    out = Path(__file__).parent / 'data'
    out.mkdir(exist_ok=True)
    (out/'euecb.json').write_text(json.dumps(dict(meta=meta, records=rows), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps(dict(records=len(rows), unique_codes=len(counts), linked=sum(r['evidence_line'] is not None for r in rows), duplicate_records=sum(r['duplicate_code'] for r in rows))))

if __name__ == '__main__':
    main()
