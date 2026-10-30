#!/usr/bin/env python3
"""Read-only adapter for public, compatible Tokko website templates. Never writes to CRM."""
import argparse
import html
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup


def clean(value):
    soup = BeautifulSoup(html.unescape(value), 'html.parser')
    for el in soup(['script', 'style']):
        el.decompose()
    for br in soup.select('br'):
        br.replace_with('\n')
    for el in soup.select('p,div'):
        el.append('\n')
    return re.sub(r'\n[ \t]*\n[\s\n]*', '\n\n', soup.get_text()).strip()


def text(el):
    return el.get_text(' ', strip=True) if el else ''


def number(value):
    found = re.search(r'\d+(?:[.,]\d+)?', value)
    return float(found.group().replace(',', '.')) if found else 0


def links(page):
    soup = BeautifulSoup(page, 'html.parser')
    return {re.search(r'/p/(\d+)', a['href']).group(1): a['href']
            for a in soup.select('a[href]') if re.search(r'/p/\d+', a['href'])}


def parse_listing(page, url, source_id, region, city, location_map=None):
    soup = BeautifulSoup(page, 'html.parser')
    details = {text(el.select_one('b')): text(el).removeprefix(text(el.select_one('b'))).strip()
               for el in soup.select('#ficha_detalle_cuerpo .ficha_detalle_item')}
    address = text(soup.select_one('.title-address'))
    if not address or not details.get('Tipo de Propiedad'):
        raise ValueError('Plantilla no reconocida: revisar el adaptador, no cargar datos vacíos.')
    basic, surfaces = {}, {}
    for selector, target in [('#lista_informacion_basica li', basic), ('#lista_superficies li', surfaces)]:
        for el in soup.select(selector):
            key, value = text(el).split(':', 1)
            target[key.strip()] = value.strip()
    reference = text(soup.select_one('#ficha_detalle_ref')).removeprefix('(REF. ').removesuffix(')')
    sections = []
    # Amenities may be siblings of ficha_desc, not descendants of it.
    for section in soup.select('section[id^="ficha_"]'):
        values = [text(el) for el in section.select('li')]
        if values:
            sections.append(text(section.select_one('.titulo2')) + '\n' + '\n'.join(values))
    sections.append('DETALLES DE LA FICHA\n' + '\n'.join(f'{key}: {value}' for key, value in details.items()))
    description = '\n\n'.join([clean(text(soup.select_one('#prop-desc')))] + sections).strip()
    images = list(dict.fromkeys(urljoin(url, el['src']) for el in soup.select('img.zoomImg[src]')))
    offers, issues = [], []
    for op in soup.select('.operations-box .operation-div'):
        operation, price = text(op.select_one('.operation-type-div')), text(op.select_one('.operation-val'))
        if operation not in ['VENTA', 'ALQUILER']:
            raise ValueError(f'Operación no soportada: {operation}; preservar la ficha y adaptar.')
        currency = 'USD' if 'USD' in price else 'ARS' if '$' in price else 'EUR' if 'EUR' in price else None
        amount = re.sub(r'[^0-9,.]', '', price).replace('.', '').replace(',', '.')
        if not currency or not amount or float(amount) <= 0:
            issues.append(f'Sin precio publicado: {operation}: {price}. Oferta pendiente de revisión.')
            continue
        offers.append({'operation': 'sale' if operation == 'VENTA' else 'rent', 'amount': amount,
                       'currency': currency, 'period': 'total' if operation == 'VENTA' else 'month',
                       'notes': f'Precio de origen: {price}. Referencia: {reference}. Origen: {url}'})
    if not offers and not issues:
        issues.append('Sin precio publicado: revisar operaciones antes de crear ofertas.')
    missing = [key for key in ['Dormitorios', 'Baños'] if key not in basic]
    area_key = next((key for key in ['Total Construido', 'Cubierta', 'Terreno'] if key in surfaces), None)
    if not area_key:
        missing.append('Superficie')
    if missing:
        issues.append('No informado: ' + ', '.join(missing) + '. El 0 del CRM indica dato desconocido, no una medida confirmada.')
    if area_key:
        issues.append(f'Superficie general tomada de {area_key}: {surfaces[area_key]}. Se conservan todas en descripción.')
    if len(images) > 30:
        issues.append('Más de 30 fotos: el manifiesto conserva todas; resolver el límite antes de aplicar.')
    location = details.get('Ubicación', '')
    mapped_city = (location_map or {}).get(location, location or city)
    types = {'Casa': 'house', 'Departamento': 'apartment', 'Terreno': 'land', 'Local': 'store', 'Oficina': 'office', 'Depósito': 'warehouse'}
    # Published pages are treated as available only when no explicit state badge is present.
    state = 'available'
    for badge in soup.select('.ribbon, .prop-status, .property-status, .status'):
        value = text(badge).lower()
        if 'reservad' in value: state = 'reserved'
        elif 'vendid' in value: state = 'sold'
        elif 'alquilad' in value: state = 'rented'
    property_data = dict(title=details['Tipo de Propiedad'] + ' — ' + address,
                         type=types.get(details['Tipo de Propiedad'], 'other'), status=state,
                         country='AR', region=region, city=mapped_city, neighborhood='', privateAddress='',
                         publicAddress=address, description=description,
                         privateNotes='Ubicación original: ' + location + '\n' + '\n'.join(issues),
                         area=number(surfaces[area_key]) if area_key else 0,
                         bedrooms=int(number(basic.get('Dormitorios', ''))), bathrooms=int(number(basic.get('Baños', ''))),
                         ownerId='', assigneeId='')
    return {'source': {'id': source_id, 'url': url, 'reference': reference},
            'property': property_data, 'offers': offers, 'photos': images}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', required=True)
    parser.add_argument('--region', required=True, help='Provincia comprobada en la fuente')
    parser.add_argument('--city', required=True, help='Ciudad comprobada, si la fuente omite ubicación')
    parser.add_argument('--location-map', default='{}', help='JSON: etiqueta original a ciudad verificada')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    parsed = urlparse(args.site)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('Usar URL HTTPS pública sin credenciales.')
    base = f'https://{parsed.netloc}'
    args.output.mkdir(parents=True, exist_ok=True)
    def fetch(path):
        url = urljoin(base, path)
        if urlparse(url).netloc != parsed.netloc:
            raise ValueError('Enlace de ficha fuera del sitio autorizado.')
        with urlopen(Request(url, headers={'User-Agent': 'CRM-LAB property import (manual)'}), timeout=40) as response:
            if urlparse(response.url).netloc != parsed.netloc:
                raise ValueError('Redirección fuera del sitio; revisar el origen.')
            return response.read(5000000).decode('utf-8')
    found = {}
    for page in range(1, 501):
        body = fetch('/Propiedades' + (f'?o=2,2&p={page}' if page > 1 else ''))
        (args.output / f'catalog-{page}.html').write_text(body)
        current = links(body)
        if not current: break
        new = set(current) - set(found)
        if not new: raise ValueError('Paginación repetida: no se puede garantizar el catálogo completo.')
        found.update(current)
        time.sleep(.5)
    else: raise ValueError('Límite de páginas alcanzado; revisar antes de importar.')
    items = []
    for source_id, path in found.items():
        url = urljoin(base, path)
        body = fetch(path)
        (args.output / f'{source_id}.html').write_text(body)
        items.append(parse_listing(body, url, source_id, args.region, args.city, json.loads(args.location_map)))
        time.sleep(.5)
    (args.output / 'manifest.json').write_text(json.dumps({'schemaVersion': '1.0', 'items': items}, ensure_ascii=False, indent=2))
    print(json.dumps({'properties': len(items), 'offers': sum(len(x['offers']) for x in items),
                      'photos': sum(len(x['photos']) for x in items), 'reviewRequired': True}))

if __name__ == '__main__':
    main()
