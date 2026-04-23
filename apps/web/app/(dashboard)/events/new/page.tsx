import EventForm from '@/components/events/EventForm'

export default function NewEventPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Event</h1>
      <EventForm />
    </div>
  )
}
