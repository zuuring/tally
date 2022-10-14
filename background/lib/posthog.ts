interface HogEventProp {
  distinct_id: string
  data: string
}

export interface HogEvent {
  api_key: string
  event: string
  properties: {
    [key: string]: HogEventProp
  }
}

type HogResponse = {
  data: string
}

export async function createEvent(
  eventName: string,
  userID: string
): Promise<HogResponse> {
  try {
    const posthogEventId = eventName

    const response = await fetch("https://app.posthog.com/capture/", {
      method: "POST",
      body: JSON.stringify({
        // this is a safe public write only api key
        // roll this key for demo
        api_key: "phc_VzveyNxrn2xyiKDYn7XjrgaqELGeUilDZGiBVh6jNmh",
        event: posthogEventId,
        properties: {
          distinct_id: userID,
          data: "This adds posthog events to Tally extension",
          current_url: window.location.href,
          $lib: window.location.href,
        },
      }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Error! status: ${response.status}`)
    }
    const result = (await response.json()) as HogResponse

    return result
  } catch (error) {
    if (error instanceof Error) {
      return Promise.reject(error.message)
    }
    return Promise.reject()
  }
}

export function posthogEvent(eventName: string) {
  chrome.cookies.get(
    { url: "https://localhost:8001/", name: "UUID" },

    function fetchCookie(cookie) {
      if (cookie) {
        createEvent(eventName, cookie.value)
        // eslint-disable-next-line no-console
        console.log("UUID: ", cookie.value)
      }
    }
  )
}
