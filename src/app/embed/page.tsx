import BookingPageContent from '../page';

export const metadata = {
  title: 'Book a Call - RevFactor',
};

// The embed page uses the same booking widget but without the outer padding
export default function EmbedPage() {
  return <BookingPageContent />;
}
