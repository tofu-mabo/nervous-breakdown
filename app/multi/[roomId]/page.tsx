import MultiRoomClient from "@/components/MultiRoomClient";

export default function RoomPage({ params }: { params: { roomId: string } }) {
  return <MultiRoomClient roomId={params.roomId} />;
}
