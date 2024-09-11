import { createTheme } from "@mui/material";
import { orange } from "@mui/material/colors";

export const theme = createTheme({
    cssVariables: true,
    palette: {
        primary: {
            main: orange[800],
        },
    },
});
