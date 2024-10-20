import { showNotification } from "@mantine/notifications";

export const setShowNotification = (message: string, color: string) => {
  return showNotification({
    message,
    color,
    autoClose: 3000,
  });
}

export default setShowNotification
