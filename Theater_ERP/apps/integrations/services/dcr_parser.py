import pdfplumber
import pandas as pd
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

class DistrictDCRParser:
    """Service to parse District DCR PDFs using pdfplumber and regex fallback."""
    
    VERSION = '1.0'

    @staticmethod
    def clean_decimal(val):
        """Helper to safely convert string to Decimal."""
        if not val:
            return Decimal('0')
        if isinstance(val, (int, float, Decimal)):
            return Decimal(str(val))
        clean_str = re.sub(r'[^\d.]', '', str(val))
        try:
            return Decimal(clean_str) if clean_str else Decimal('0')
        except InvalidOperation:
            return Decimal('0')

    @classmethod
    def parse_pdf(cls, file_path):
        """
        Parses the DCR PDF and extracts all relevant fields.
        Returns a dictionary with raw data and confidence score.
        """
        parsed_data = {
            'report_date': None,
            'movie_title': 'Unknown Movie',
            'screen_name': 'Unknown Screen',
            'show_time': None,
            'ticket_classes': [],
            'gross_revenue': Decimal('0'),
            'parsed_occupancy': Decimal('0'),
            'gst': Decimal('0'),
            'etax': Decimal('0'),
            'cess': Decimal('0'),
            'kfc': Decimal('0'),
            'repbeta': Decimal('0'),
            'nett_revenue': Decimal('0'),
            'distributor_share': Decimal('0'),
            'exhibitor_share': Decimal('0'),
            'raw_text': '',
            'confidence_score': 1.0
        }

        try:
            if file_path.lower().endswith('.csv'):
                import csv
                full_text = []
                with open(file_path, mode='r', encoding='utf-8-sig', errors='replace') as f:
                    reader = csv.reader(f)
                    for row in reader:
                        if row:
                            row_text = " ".join([val.strip() for val in row if val.strip()])
                            full_text.append(row_text)
                raw_text = "\n".join(full_text)
                parsed_data['raw_text'] = raw_text
            else:
                with pdfplumber.open(file_path) as pdf:
                    full_text = []
                    for page in pdf.pages:
                        text = page.extract_text()
                        if text:
                            full_text.append(text)
                        
                        # Optional: extract tables via pdfplumber
                        tables = page.extract_tables()
                        for table in tables:
                            # Attempt to interpret tables
                            df = pd.DataFrame(table[1:], columns=table[0]) if len(table) > 1 else pd.DataFrame()
                            # We could use pandas logic here if the structure is known
                            # For now, regex fallback on raw text is robust for unstructured DCRs

                    raw_text = "\n".join(full_text)
                    parsed_data['raw_text'] = raw_text

                # ── REGEX EXTRACTION FALLBACK ────────────────────────────────────
                
                # Date (e.g., Date: 2024-05-15 or 15/05/2024 or 23-May-2026)
                date_match = re.search(r'(?i)Date\s*:\s*([\w\d\s\-\/]+)', raw_text)
                if date_match:
                    try:
                        # Try parsing common formats
                        dt_str = date_match.group(1).strip()
                        if '/' in dt_str:
                            parsed_data['report_date'] = datetime.strptime(dt_str, '%d/%m/%Y').date()
                        elif '-' in dt_str:
                            try:
                                parsed_data['report_date'] = datetime.strptime(dt_str, '%Y-%m-%d').date()
                            except ValueError:
                                parsed_data['report_date'] = datetime.strptime(dt_str, '%d-%b-%Y').date()
                    except Exception:
                        pass
                
                if not parsed_data['report_date']:
                    parsed_data['report_date'] = datetime.now().date() # Fallback

                # Movie Title
                movie_match = re.search(r'(?i)(?:Movie|Picture)\s*:\s*(.+)', raw_text)
                if movie_match:
                    parsed_data['movie_title'] = movie_match.group(1).strip()

                # Screen
                screen_match = re.search(r'(?i)(?:Screen[\s:]+|AUDI\s+)(\d+)', raw_text)
                if screen_match:
                    parsed_data['screen_name'] = f"Screen {screen_match.group(1).strip()}"
                else:
                    screen_match_raw = re.search(r'(?i)Screen\s*:\s*(.+)', raw_text)
                    if screen_match_raw:
                        parsed_data['screen_name'] = screen_match_raw.group(1).strip()

                # Show Time
                time_match = re.search(r'(?i)Time[\s:]+([\d:]+\s*[AM|PM|am|pm]*)', raw_text)
                if time_match:
                    try:
                        parsed_data['show_time'] = datetime.strptime(time_match.group(1).strip(), '%I:%M %p').time()
                    except:
                        pass

                # Ticket Classes (Looking for lines like: GOLD 290 180.00 27.46 11.56 54,347 54,412 66 11,880.00)
                ticket_classes = ['Platinum', 'Gold', 'Silver', 'Balcony', 'First Class']
                class_pattern = '|'.join(ticket_classes)
                show_rows = re.findall(rf'(?i)({class_pattern})\s+(\d+)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)\s+([\d,]+)\s+([\d,]+)\s+(\d+)\s+([\d\.,]+)', raw_text)
                
                class_totals = {}
                for row in show_rows:
                    tclass_name = row[0].capitalize()
                    sold = int(row[7])
                    rate = cls.clean_decimal(row[2])
                    total = cls.clean_decimal(row[8])
                    
                    if tclass_name not in class_totals:
                        class_totals[tclass_name] = {
                            'ticket_count': 0,
                            'ticket_rate': rate,
                            'parsed_total': Decimal('0')
                        }
                    class_totals[tclass_name]['ticket_count'] += sold
                    class_totals[tclass_name]['parsed_total'] += total

                for tclass_name, info in class_totals.items():
                    parsed_data['ticket_classes'].append({
                        'ticket_class_name': tclass_name,
                        'ticket_count': info['ticket_count'],
                        'ticket_rate': info['ticket_rate'],
                        'parsed_total': info['parsed_total']
                    })

                # Financials Extraction
                # Try parsing Screen Wise Total line:
                # Screen Wise Total : 1449 271,880.00 41,476.98 2,898.00 4,347.00 17,485.14 205,672.88
                screen_wise_match = re.search(r'(?i)Screen\s+Wise\s+Total\s*:\s*(\d+)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)', raw_text)
                if screen_wise_match:
                    parsed_data['parsed_occupancy'] = cls.clean_decimal(screen_wise_match.group(1))
                    parsed_data['gross_revenue'] = cls.clean_decimal(screen_wise_match.group(2))
                    parsed_data['gst'] = cls.clean_decimal(screen_wise_match.group(3))
                    parsed_data['parsed_convenience_fee'] = cls.clean_decimal(screen_wise_match.group(4)) # SC column
                    parsed_data['cess'] = cls.clean_decimal(screen_wise_match.group(5))
                    parsed_data['etax'] = cls.clean_decimal(screen_wise_match.group(6))
                else:
                    gross_match = re.search(r'(?i)Gross\s*(?:Collection|Revenue)?\s*[\s:]+([\d\.,]+)', raw_text)
                    if gross_match: parsed_data['gross_revenue'] = cls.clean_decimal(gross_match.group(1))
                    gst_match = re.search(r'(?i)GST\s*[\s:]+([\d\.,]+)', raw_text)
                    if gst_match: parsed_data['gst'] = cls.clean_decimal(gst_match.group(1))
                    etax_match = re.search(r'(?i)Entertainment\s*Tax\s*[\s:]+([\d\.,]+)', raw_text)
                    if etax_match: parsed_data['etax'] = cls.clean_decimal(etax_match.group(1))
                    cess_match = re.search(r'(?i)Cess\s*[\s:]+([\d\.,]+)', raw_text)
                    if cess_match: parsed_data['cess'] = cls.clean_decimal(cess_match.group(1))

                # Try parsing current day totals from SUMMARY table (the Total Etax line)
                # Total Etax 17,485.14 1449 271,880.00 204,970.88 122,982.53 81,988.35
                summary_line_match = re.search(r'(?i)Total\s+Etax\s+([\d\.,]+)\s+(\d+)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)', raw_text)
                if summary_line_match:
                    parsed_data['etax'] = cls.clean_decimal(summary_line_match.group(1))
                    parsed_data['parsed_occupancy'] = cls.clean_decimal(summary_line_match.group(2))
                    parsed_data['gross_revenue'] = cls.clean_decimal(summary_line_match.group(3))
                    parsed_data['nett_revenue'] = cls.clean_decimal(summary_line_match.group(4))
                    parsed_data['distributor_share'] = cls.clean_decimal(summary_line_match.group(5))
                    parsed_data['exhibitor_share'] = cls.clean_decimal(summary_line_match.group(6))
                else:
                    nett_match = re.search(r'(?i)Nett\s*(?:Collection|Revenue)?\s*[\s:]+([\d\.,]+)', raw_text)
                    if nett_match: parsed_data['nett_revenue'] = cls.clean_decimal(nett_match.group(1))
                    dist_match = re.search(r'(?i)Distributor\s*Share\s*[\s:]+([\d\.,]+)', raw_text)
                    if dist_match: parsed_data['distributor_share'] = cls.clean_decimal(dist_match.group(1))
                    exhib_match = re.search(r'(?i)Exhibitor\s*Share\s*[\s:]+([\d\.,]+)', raw_text)
                    if exhib_match: parsed_data['exhibitor_share'] = cls.clean_decimal(exhib_match.group(1))

                # Flat charges parsing: KFC and Rep Beta
                kfc_match = re.search(r'(?i)K\.?F\.?C\.?\s*[\s:]+([\d\.,]+)', raw_text)
                if kfc_match: parsed_data['kfc'] = cls.clean_decimal(kfc_match.group(1))
                
                repbeta_match = re.search(r'(?i)Rep\s*Betta?\s*[\s:]+([\d\.,]+)', raw_text)
                if repbeta_match: parsed_data['repbeta'] = cls.clean_decimal(repbeta_match.group(1))

        except Exception as e:
            parsed_data['confidence_score'] = 0.0
            print(f"Error parsing PDF: {e}")

        return parsed_data
