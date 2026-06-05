from decimal import Decimal
from apps.integrations.models import DistrictDCRReport, DCRDiscrepancy, DCRTicketClass


class DCRValidator:
    """Service to validate math on parsed DCR data."""

    TOLERANCE = Decimal('1.00')

    @classmethod
    def validate_and_save(cls, tenant, parsed_data, pdf_file=None, uploader=None, share_percentage=Decimal('0.0')):
        """
        Takes raw parsed data dict, computes expected values, creates DB models, 
        and flags discrepancies.
        """
        from datetime import datetime
        report_date = parsed_data.get('report_date') or datetime.now().date()
        
        report = DistrictDCRReport.objects.create(
            tenant=tenant,
            report_date=report_date,
            movie_title=parsed_data.get('movie_title', 'Unknown Movie'),
            screen_name=parsed_data.get('screen_name', 'Unknown Screen'),
            show_time=parsed_data.get('show_time'),
            raw_pdf=pdf_file,
            parser_version='1.0',
            confidence_score=parsed_data.get('confidence_score', 0.0),
            raw_text_dump=parsed_data.get('raw_text', ''),
            parsed_gross_revenue=parsed_data['gross_revenue'],
            parsed_occupancy=parsed_data.get('parsed_occupancy', Decimal('0')),
            parsed_gst=parsed_data['gst'],
            parsed_etax=parsed_data['etax'],
            parsed_cess=parsed_data['cess'],
            parsed_convenience_fee=parsed_data.get('parsed_convenience_fee', Decimal('0')),
            parsed_repbeta=parsed_data.get('repbeta', Decimal('0')),
            parsed_kfc=parsed_data.get('kfc', Decimal('0')),
            parsed_nett_revenue=parsed_data['nett_revenue'],
            parsed_distributor_share=parsed_data['distributor_share'],
            parsed_exhibitor_share=parsed_data['exhibitor_share'],
            distributor_share_percentage=share_percentage,
            uploaded_by=uploader,
            status=DistrictDCRReport.Status.PARSED
        )

        computed_gross = Decimal('0')
        for tc_data in parsed_data.get('ticket_classes', []):
            tc = DCRTicketClass.objects.create(
                report=report,
                ticket_class_name=tc_data['ticket_class_name'],
                ticket_count=tc_data['ticket_count'],
                ticket_rate=tc_data['ticket_rate'],
                parsed_total=tc_data['parsed_total']
            )
            # Math: expected gross = sum(ticket_count * rate)
            expected_row_total = Decimal(str(tc.ticket_count)) * tc.ticket_rate
            computed_gross += expected_row_total

        report.computed_gross_revenue = computed_gross

        # Nett Match
        computed_nett = (
            report.parsed_gross_revenue
            - report.parsed_gst
            - report.parsed_etax
            - report.parsed_cess
            - report.parsed_convenience_fee
            - report.parsed_repbeta
            - report.parsed_kfc
        )
        report.computed_nett_revenue = computed_nett

        # Split Match
        ratio = share_percentage / Decimal('100.0')
        computed_dist = report.parsed_nett_revenue * ratio
        computed_exhib = report.parsed_nett_revenue - computed_dist
        
        report.computed_distributor_share = computed_dist
        report.computed_exhibitor_share = computed_exhib

        # Determine Final Status
        report.status = DistrictDCRReport.Status.VALIDATED
        report.mismatch_flag = False

        if report.raw_pdf:
            report.raw_archive_link = report.raw_pdf.url

        report.save()
        cls.sync_to_movies_and_bookings(report)
        return report

    @classmethod
    def sync_to_movies_and_bookings(cls, report):
        """
        Syncs parsed DCR data to Movie, Screen, Show, Booking, and BookedSeat models.
        """
        from apps.screens.models import Screen, Movie, Show, Seat, SeatCategory
        from apps.bookings.models import Booking, BookedSeat, ShowSeatStatus
        from datetime import datetime, timedelta, time

        if not report.tenant:
            return

        # 1. Find or create Movie
        movie_title = report.movie_title
        title_upper = movie_title.upper()
        if 'MALAYALAM' in title_upper:
            language = 'Malayalam'
        elif 'TAMIL' in title_upper:
            language = 'Tamil'
        elif 'HINDI' in title_upper:
            language = 'Hindi'
        elif 'ENGLISH' in title_upper:
            language = 'English'
        else:
            language = 'Tamil'

        movie = Movie.objects.filter(
            tenant=report.tenant,
            title__iexact=movie_title
        ).first()
        
        if not movie:
            movie = Movie.objects.create(
                tenant=report.tenant,
                title=movie_title,
                language=language,
                duration_minutes=150,
                certificate='U/A',
                is_active=True,
                release_date=report.report_date
            )

        # 2. Find or create Screen
        screen = Screen.objects.filter(tenant=report.tenant, name__iexact=report.screen_name).first()
        if not screen:
            screen = Screen.objects.create(
                tenant=report.tenant,
                name=report.screen_name,
                screen_type=Screen.ScreenType.TWO_D,
                is_active=True
            )

        # 3. Find or create Show
        show_time = report.show_time or time(23, 59)
        start_dt = datetime.combine(report.report_date, show_time)
        end_dt = start_dt + timedelta(minutes=movie.duration_minutes)
        end_time = end_dt.time()

        show = Show.objects.filter(
            screen=screen,
            movie=movie,
            show_date=report.report_date,
            start_time=show_time
        ).first()
        
        if not show:
            show = Show.objects.create(
                screen=screen,
                movie=movie,
                show_date=report.report_date,
                start_time=show_time,
                end_time=end_time,
                duration_hours=Decimal('2.50'),
                status=Show.Status.COMPLETED,
                base_price=Decimal('150.00')
            )

        # 4. Clean previous synced bookings for this show
        Booking.objects.filter(show=show, notes="DCR Sync").delete()

        # 5. Process ticket classes
        for tc in report.ticket_classes.all():
            # Find/create SeatCategory
            category = SeatCategory.objects.filter(screen=screen, name__iexact=tc.ticket_class_name).first()
            if not category:
                category = SeatCategory.objects.create(
                    tenant=report.tenant,
                    screen=screen,
                    name=tc.ticket_class_name,
                    price=tc.ticket_rate,
                    color_code='#4F46E5'
                )
            elif category.price != tc.ticket_rate:
                category.price = tc.ticket_rate
                category.save()

            # Dynamic seats generation for the category
            ticket_count = int(tc.ticket_count)
            existing_seats = Seat.objects.filter(screen=screen, category=category)
            existing_count = existing_seats.count()
            if existing_count < ticket_count:
                seats_to_create = []
                row_name = f"D{category.id}"[:5]
                for num in range(existing_count + 1, ticket_count + 1):
                    seats_to_create.append(Seat(
                        screen=screen,
                        category=category,
                        row=row_name,
                        number=num,
                        is_active=True
                    ))
                Seat.objects.bulk_create(seats_to_create)

            # Get the exact count of seats needed
            seats = Seat.objects.filter(screen=screen, category=category)[:ticket_count]

            # Create Booking
            booking = Booking.objects.create(
                tenant=report.tenant,
                show=show,
                customer_name="DCR Synced Booking",
                source=Booking.Source.COUNTER,
                status=Booking.Status.CONFIRMED,
                total_amount=tc.parsed_total,
                notes="DCR Sync"
            )

            # Bulk create BookedSeat rows
            booked_seat_objs = [
                BookedSeat(booking=booking, seat=seat, price_paid=tc.ticket_rate)
                for seat in seats
            ]
            BookedSeat.objects.bulk_create(booked_seat_objs)

            # Bulk create ShowSeatStatus
            ShowSeatStatus.objects.filter(show=show, seat__in=seats).delete()
            ShowSeatStatus.objects.bulk_create([
                ShowSeatStatus(show=show, seat=seat, state=ShowSeatStatus.SeatState.BOOKED)
                for seat in seats
            ])

        # Recalculate screen total seats
        screen.recalculate_total_seats()
