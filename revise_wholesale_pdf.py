import csv
import math
import re
import unicodedata
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


CSV_PATH = Path('/Users/mac/Downloads/inventory-stock-2026-09-15 (1).csv')
PDF_PATH = Path('/Users/mac/Downloads/wholesale-price-list-2026-09-15 (5).pdf')
OUTPUT_PATH = Path('/Users/mac/Documents/drinksharbour/wholesale-price-list-2026-09-15-revised.pdf')


def key(value: str) -> str:
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    value = value.lower().replace('tapada do barao', 'monte do barao')
    value = value.replace('monte dos perdigoes', 'monte dos perdigoes')
    return re.sub(r'[^a-z0-9]+', '', value)


def money(value: float) -> str:
    return f'NGN {value:,.2f}'


def price_row(row: dict) -> dict:
    wholesale = float(row['Wholesale Price'])
    distribution_unit = wholesale * 1.075
    wholesale_unit = wholesale * 1.10 * 1.075
    return {
        'product': row['Product'],
        'size': row['Size'].strip('"'),
        'category': row['Category'],
        'distribution': distribution_unit * 6,
        'wholesale': wholesale_unit * 6,
        'selling': float(row['Selling Price']),
    }


def main() -> None:
    with CSV_PATH.open(newline='', encoding='utf-8-sig') as handle:
        inventory = {key(row['Product']): row for row in csv.DictReader(handle)}

    pdf_products = [
        ('Lagar dos Perdigões Colheita Vinho Tinto', 'Red Wine'),
        ('Lagar dos Perdigões Reserva Alentejano Vinho Tinto', 'Red Wine'),
        ('Monte Dos Perdigoes Vinhas Velhas Tinto', 'Red Wine'),
        ('Poliphonia Family Blend Vinho Tinto', 'Red Wine'),
        ('Sunblessed Vinho Tinto', 'Red Wine'),
        ('Tapada do Barao Colheita Selectionada Vinho Tinto', 'Red Wine'),
        ('Lagar dos Perdigões Colheita Vinho Branco', 'White Wine'),
        ('Sunblessed Vinho Branco', 'White Wine'),
        ('Tapada do Barao Colheita Selectionada Vinho Branco', 'White Wine'),
    ]

    rows = []
    for product, category in pdf_products:
        source = inventory.get(key(product))
        if source is None:
            raise RuntimeError(f'Missing CSV match for {product}')
        item = price_row(source)
        item['category'] = category
        if key(product) == key('Monte Dos Perdigoes Vinhas Velhas Tinto'):
            item['distribution'] = 153352.80
            item['wholesale'] = 168688.80
            item['selling'] = 35500.00
        csv_wholesale = float(source['Wholesale Price'])
        if key(product) != key('Monte Dos Perdigoes Vinhas Velhas Tinto'):
            item['selling'] = math.ceil((csv_wholesale * 1.40) / 100) * 100
        rows.append(item)

    width, height = A4
    pdf = canvas.Canvas(str(OUTPUT_PATH), pagesize=A4)
    pdf.setTitle('Wholesale Price List PL-20260915 Revised')
    pdf.setAuthor('Cloud Bay Wyn City Enterprise Limited')

    red = colors.HexColor('#c40000')
    dark_red = colors.HexColor('#570000')
    text = colors.HexColor('#1f2329')
    muted = colors.HexColor('#4b5563')
    border = colors.HexColor('#d9d9d9')
    pale = colors.HexColor('#fafafa')

    # Branded header.
    pdf.setFillColor(red)
    pdf.rect(0, height - 108, width, 108, fill=1, stroke=0)
    pdf.setFillColor(dark_red)
    pdf.wedge(width * 0.52, height - 108, width * 1.03, height + 30, 265, 90, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont('Helvetica', 15)
    pdf.drawString(40, height - 42, 'Cloud Bay Wyn City Enterprise Limited')
    pdf.setFont('Helvetica', 8.5)
    pdf.drawString(40, height - 60, '9 Close C Sungold Estate, Galadimawa, Abuja, FCT, Nigeria')
    pdf.drawString(40, height - 72, 'info@wyncity.ng')
    pdf.setStrokeColor(colors.white)
    pdf.roundRect(40, height - 92, 88, 14, 7, fill=0, stroke=1)
    pdf.setFont('Helvetica', 6.5)
    pdf.drawCentredString(84, height - 87, 'CUSTOMER PRICELIST')
    pdf.setFillColor(colors.HexColor('#d6a900'))
    pdf.rect(0, height - 111, width, 3, fill=1, stroke=0)
    pdf.setFillColor(colors.HexColor('#d9a3a3'))
    pdf.setFont('Helvetica', 7.5)
    pdf.drawRightString(width - 40, height - 30, 'WHOLESALE PRICE LIST')
    pdf.setFillColor(colors.white)
    pdf.setFont('Helvetica', 18)
    pdf.drawRightString(width - 40, height - 56, 'PL-20260915')

    # Metadata cards.
    card_y, card_h, gap = height - 166, 33, 7
    card_w = (width - 80 - gap * 3) / 4
    cards = [('GENERATED', '15 Sep 2026'), ('VALID UNTIL', '15 Nov 2026'), ('ITEMS', '9'), ('WAREHOUSES', '1')]
    for i, (label, value) in enumerate(cards):
        x = 40 + i * (card_w + gap)
        pdf.setFillColor(colors.HexColor('#fbfbfb'))
        pdf.setStrokeColor(border)
        pdf.roundRect(x, card_y, card_w, card_h, 4, fill=1, stroke=1)
        pdf.setFillColor(red)
        pdf.rect(x + 3, card_y + card_h - 3, card_w - 6, 2, fill=1, stroke=0)
        pdf.setFillColor(muted)
        pdf.setFont('Helvetica', 6.5)
        pdf.drawString(x + 6, card_y + 20, label)
        pdf.setFillColor(text)
        pdf.setFont('Helvetica', 8.5)
        pdf.drawString(x + 6, card_y + 9, value)

    # Pricing table.
    left, right = 40, width - 40
    columns = [left, 282, 318, 399, 480, right]
    table_top = card_y - 14
    header_h, section_h, row_h = 23, 20, 24
    pdf.setFillColor(red)
    pdf.rect(left, table_top - header_h, right - left, header_h, fill=1, stroke=0)
    headers = ['Product', 'Size', 'Distributors Price', 'Wholesalers Price', 'Recommended Sales Price']
    for i, label in enumerate(headers):
        x0, x1 = columns[i], columns[i + 1]
        pdf.setFillColor(colors.white)
        pdf.setFont('Helvetica', 7.5 if i else 8.8)
        if i == 0:
            pdf.drawString(x0 + 6, table_top - 15, label)
        elif i == 4:
            pdf.setFont('Helvetica', 6.2)
            pdf.drawCentredString((x0 + x1) / 2, table_top - 10, 'Recommended Sales')
            pdf.drawCentredString((x0 + x1) / 2, table_top - 18, 'Price')
        else:
            pdf.drawCentredString((x0 + x1) / 2, table_top - 15, label)

    y = table_top - header_h
    item_index = 0
    for category in ('Red Wine', 'White Wine'):
        pdf.setFillColor(colors.HexColor('#fbf8f8'))
        pdf.setStrokeColor(border)
        pdf.rect(left, y - section_h, right - left, section_h, fill=1, stroke=1)
        pdf.setFillColor(text)
        pdf.setFont('Helvetica', 8.8)
        pdf.drawString(left + 6, y - 14, f'{category.upper()} — {sum(r["category"] == category for r in rows)}')
        y -= section_h
        for item in [r for r in rows if r['category'] == category]:
            pdf.setFillColor(colors.white if item_index % 2 == 0 else pale)
            pdf.setStrokeColor(border)
            pdf.rect(left, y - row_h, right - left, row_h, fill=1, stroke=1)
            pdf.setFillColor(text)
            pdf.setFont('Helvetica', 7.8)
            pdf.drawString(left + 6, y - 15, item['product'])
            values = [item['size'], money(item['distribution']), money(item['wholesale']), money(item['selling'])]
            for i, value in enumerate(values, start=1):
                x0, x1 = columns[i], columns[i + 1]
                pdf.setFont('Helvetica', 7.0)
                pdf.drawCentredString((x0 + x1) / 2, y - 15, value)
            y -= row_h
            item_index += 1

    # Add clean visual gutters between columns so the pricing fields do not read
    # as one continuous block.
    pdf.setStrokeColor(colors.white)
    pdf.setLineWidth(2.2)
    for x in columns[1:-1]:
        pdf.line(x, table_top, x, y)

    # Notes and footer.
    note_y = y - 48
    pdf.setFillColor(colors.HexColor('#fbfbfb'))
    pdf.setStrokeColor(border)
    pdf.roundRect(left, note_y, right - left, 42, 4, fill=1, stroke=1)
    pdf.setFillColor(red)
    pdf.rect(left + 2, note_y + 4, 2, 34, fill=1, stroke=0)
    pdf.setFillColor(muted)
    pdf.setFont('Helvetica', 6.5)
    pdf.drawString(left + 14, note_y + 27, 'NOTES')
    pdf.setFillColor(text)
    pdf.setFont('Helvetica', 8)
    pdf.drawString(left + 14, note_y + 14, 'Prices valid until 15 Nov 2026. Subject to stock availability. 7.5% tax included.')
    pdf.setStrokeColor(border)
    pdf.line(left, 42, right, 42)
    pdf.setFillColor(red)
    pdf.rect(left, 42, 28, 3, fill=1, stroke=0)
    pdf.setFillColor(muted)
    pdf.setFont('Helvetica', 5.5)
    pdf.drawString(left, 26, 'Cloud Bay Wyn City Enterprise Limited | 9 Close C Sungold Estate, Galadimawa | Abuja, FCT, Nigeria |')
    pdf.drawString(left, 18, 'info@wyncity.ng')
    pdf.drawRightString(right, 26, 'PL-20260915 | Generated 15 Sept 2026 | Page 1 of 1')
    pdf.save()
    print(OUTPUT_PATH)
    for item in rows:
        print(item['product'], money(item['distribution']), money(item['wholesale']), money(item['selling']))


if __name__ == '__main__':
    main()
