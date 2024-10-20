import { showNotification } from "@mantine/notifications";

export const showSuccessNotification = (message: string) => {
  return showNotification({
    message,
    color: "orange",
    autoClose: 3000,
  });
}

export default showSuccessNotification
