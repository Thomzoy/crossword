import cv2
import numpy as np

DEFAULT_HEIGHT = 4032

def parse(image_path: str) -> None:
    """
    Parse the crossword image to find lines and intersections.
    """
    # Read and resize the image
    image = cv2.imread(image_path)
    image = cv2.resize(image, (int(image.shape[1] * DEFAULT_HEIGHT / image.shape[0]), DEFAULT_HEIGHT))

    clean_image  = image.copy()

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    img_blur = cv2.GaussianBlur(gray, (5, 5), 0)  # Apply Gaussian blur to reduce noise

    edges = cv2.Canny(img_blur,100,200,apertureSize = 3)
    #cv2.imwrite('canny1.jpg',edges)
    kernel = np.ones((15,15),np.uint8)
    edges = cv2.dilate(edges,kernel,iterations = 1)
    #cv2.imwrite('canny2.jpg',edges)
    kernel = np.ones((2,2),np.uint8)
    edges = cv2.erode(edges,kernel,iterations = 1)
    #cv2.imwrite('canny3.jpg',edges)

    thresh = cv2.adaptiveThreshold(img_blur,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV,57,5)

    white_image = edges.copy()
    white_image[:] = 0

    lines = cv2.HoughLinesP(edges, 1, np.pi/180, 100, minLineLength=500, maxLineGap=25)

    # Draw the lines on the original image
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            cv2.line(image, (x1, y1), (x2, y2), (0, 0, 255), 2)
            cv2.line(white_image, (x1, y1), (x2, y2), 255, 2)

    kernel = np.ones((15,15),np.uint8)
    white_image = cv2.dilate(white_image,kernel,iterations = 1)
    white_image = 255 - white_image
    cnts, hierarchy = cv2.findContours(white_image, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    rectangles = [cv2.boundingRect(c) for c in cnts]
    centers = [(x + w // 2, y + h // 2) for (x, y, w, h) in rectangles]
    ratios = [min(w, h) / max(w, h) for (x, y, w, h) in rectangles]
    import pandas as pd

    contours_infos = pd.DataFrame(
        {
            "center": centers,
            "ratio": ratios,
            "area": [cv2.contourArea(c) for c in cnts],
            "rectangle": rectangles,
            "parent": hierarchy[0][:, -1],
        }
    )
    contours_infos["diff_99_num_siblings"] = (contours_infos["parent"].map(contours_infos["parent"].value_counts())-99).abs()
    contours_infos["is_closest_to_99_siblings"] = contours_infos["diff_99_num_siblings"] == contours_infos["diff_99_num_siblings"].min()
    contours_infos["center_x"] = contours_infos["center"].apply(lambda x: x[0])
    contours_infos["center_y"] = contours_infos["center"].apply(lambda x: x[1])
    # TODO: automate this
    contours_infos = contours_infos[contours_infos["is_closest_to_99_siblings"]]
    contours_infos["center_x_bin"] = pd.cut(contours_infos["center_x"], bins=9)
    contours_infos["center_y_bin"] = pd.cut(contours_infos["center_y"], bins=11)
    def fit_line(x,y):
        # Fit line using least squares
        A = np.vstack([x, np.ones(len(x))]).T
        m, b = np.linalg.lstsq(A, y, rcond=None)[0]

        print(f"Estimated line: y = {m:.3f}x + {b:.3f}")
        return (m,b)
    x_lines = []
    y_lines = []
    for _,df in contours_infos.groupby("center_x_bin"):
        x_lines.append(
            fit_line(df.center_x.to_numpy(), df.center_y.to_numpy())
        )
    for _,df in contours_infos.groupby("center_y_bin"):
        y_lines.append(
            fit_line(df.center_x.to_numpy(), df.center_y.to_numpy())
        )
    #cv2.imwrite('thresh.jpg', thresh)
    #cv2.imwrite('lines.jpg', image)
    #cv2.imwrite('contours.jpg', white_image)
    from itertools import chain

    for line in chain(x_lines, y_lines):
        m, b = line
        x = np.linspace(0, white_image.shape[1], 100)
        y = m * x + b
        for i in range(len(x) - 1):
            cv2.line(white_image, (int(x[i]), int(y[i])), (int(x[i+1]), int(y[i+1])), (0, 255, 0), 2)
    #cv2.imwrite('contours.jpg', white_image)
    from itertools import product

    intersections = []

    for lines in product(x_lines, y_lines):
        m1, b1 = lines[0]
        m2, b2 = lines[1]
        x = (b2 - b1) / (m1 - m2)
        y = m1 * x + b1
        intersections.append((x, y))
    brightness_values = []
    radius = 50
    clean_gray = cv2.cvtColor(clean_image, cv2.COLOR_BGR2GRAY)

    for x, y in intersections:
        # Create a circular mask of the same size as the image
        mask = np.zeros_like(clean_gray, dtype=np.uint8)
        cv2.circle(mask, (int(x), int(y)), radius, 255, -1)

        # Compute the mean brightness within the masked region
        mean_val = cv2.mean(clean_gray, mask=mask)[0]  # [0] gets the mean intensity (single channel)
        brightness_values.append(mean_val)

        cv2.circle(clean_image, (int(x), int(y)), 50, (int(mean_val), 0, 0), -1)
    df_inter = pd.DataFrame({
        "x": [x for x, _ in intersections],
        "y": [y for _, y in intersections],
        "brightness": brightness_values,
    }).sort_values(by="brightness", ascending=True).reset_index(drop=True)

    df_inter["delta"] = df_inter["brightness"].diff().fillna(0)
    delta_argmax = df_inter.delta.argmax()
    df_inter["is_white"] = df_inter.index >= delta_argmax
    df_inter["is_white"].value_counts()
    #cv2.imwrite('points.jpg', clean_image)

    df = df_inter[df_inter["is_white"]]
    coords = list(zip(df['x'].astype(int), df['y'].astype(int)))
    square_pixel_height = df_inter.sort_values(by="x").y[:7].diff().mean()

    return coords, square_pixel_height