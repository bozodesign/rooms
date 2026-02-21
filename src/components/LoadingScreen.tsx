import Image from 'next/image'

interface LoadingScreenProps {
  message?: string
  fullScreen?: boolean
}

export default function LoadingScreen({ message = 'กำลังโหลด...', fullScreen = true }: LoadingScreenProps) {
  if (fullScreen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <Image
          src="/img/loadnganimate.svg"
          alt="Loading"
          width={80}
          height={80}
          priority
        />
        {message && (
          <p className="mt-4 text-zinc-500 text-sm font-medium">{message}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Image
        src="/img/loadnganimate.svg"
        alt="Loading"
        width={60}
        height={60}
        priority
      />
      {message && (
        <p className="mt-3 text-zinc-500 text-sm">{message}</p>
      )}
    </div>
  )
}
