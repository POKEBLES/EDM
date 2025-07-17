import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from sklearn.linear_model import LinearRegression
import numpy as np

# Load the dataset
# Assuming 'top_1000_firms.xlsx - Data.csv' is the correct file for data
df = pd.read_excel('top_1000_firms.xlsx')

# Handle non-finite values in 'mnc' before converting to integer
df['mnc'] = df['mnc'].fillna(0).astype(int)

# Map mnc values to descriptive labels for better legend
df['Firm Type'] = df['mnc'].map({0: 'Domestic', 1: 'Multinational'})

# Calculate profit rate (rprofit) if not already present or to ensure consistency
# Assuming 'profit' and 'sales' columns exist for this calculation
if 'rprofit' not in df.columns:
    df['rprofit'] = np.where(df['sales'] != 0, (df['profit'] / df['sales']) * 100, 0)
    print("Calculated 'rprofit' from 'profit' and 'sales'.")

# --- NEW: Filter for top 1000 companies based on average sales ---
# Calculate average sales for each unique company
average_sales_per_company = df.groupby('company_name')['sales'].mean()

# Get the names of the top 1000 companies by average sales
top_1000_companies_names = average_sales_per_company.nlargest(1000).index.tolist()

# Filter the DataFrame to include only these top 1000 companies
df = df[df['company_name'].isin(top_1000_companies_names)].copy()
print(f"Filtered data to include {df['company_name'].nunique()} unique companies (top 1000 by average sales).")
# --- END NEW ---

def get_traces_for_year(data_frame, year_to_plot):
    """
    Generates scatter and regression line traces for a specific year.

    Args:
        data_frame (pd.DataFrame): The full DataFrame.
        year_to_plot (int): The year for which to generate the traces.

    Returns:
        list: A list of Plotly graph_objects.Trace instances.
    """
    df_year = data_frame[data_frame['year'] == year_to_plot].copy()
    traces = []

    if df_year.empty:
        print(f"No data available for the year {year_to_plot}.")
        return traces

    # Define colors for firm types
    colors = {0: '#4E6688', 1: '#79D7BE'} # Domestic: blue, Multinational: red

    # Add scatter points for Domestic and Multinational firms
    for firm_type_value, firm_type_label in {0: 'Domestic', 1: 'Multinational'}.items():
        df_subset = df_year[df_year['mnc'] == firm_type_value].dropna(subset=['sales', 'rprofit'])

        if not df_subset.empty:
            traces.append(go.Scatter(
                x=df_subset['sales'],
                y=df_subset['rprofit'],
                mode='markers',
                name=f'{firm_type_label} ({year_to_plot})',
                marker=dict(color=colors[firm_type_value], size=8, opacity=0.7),
                hovertemplate=(
                    '<b>Company:</b> %{hovertext}<br>' +
                    '<b>Sales:</b> %{x:.2f} PHP Billions<br>' +
                    '<b>Profit Rate:</b> %{y:.2f}%<br>' +
                    '<b>Firm Type:</b> ' + firm_type_label +
                    '<extra></extra>' # Hides the default trace name in hover
                ),
                hovertext=df_subset['company_name'],
                legendgroup=firm_type_label, # Group for consistent legend item
                showlegend=False # Legend will be handled by dummy traces
            ))

            X = df_subset['sales'].values.reshape(-1, 1)
            y = df_subset['rprofit'].values

            valid_indices = np.isfinite(X).flatten() & np.isfinite(y)
            X_filtered = X[valid_indices]
            y_filtered = y[valid_indices]

            if len(X_filtered) > 1:
                model = LinearRegression()
                model.fit(X_filtered, y_filtered)

                # Ensure x_range covers the full extent of sales in the current year's data
                # This makes the regression line extend across the relevant sales range for the selected year
                current_year_sales_min = df_subset['sales'].min()
                current_year_sales_max = df_subset['sales'].max()
                x_range = np.array([current_year_sales_min, current_year_sales_max]).reshape(-1, 1)
                y_pred = model.predict(x_range)

                traces.append(go.Scatter(
                    x=x_range.flatten(),
                    y=y_pred,
                    mode='lines',
                    name=f'Regression {firm_type_label} ({year_to_plot})',
                    line=dict(dash='dash', color=colors[firm_type_value]),
                    hovertemplate=(
                        '<b>Regression Line</b><br>' +
                        '<b>Sales:</b> %{x:.2f} PHP Billions<br>' +
                        '<b>Predicted Profit Rate:</b> %{y:.2f}%<br>' +
                        '<b>Firm Type:</b> ' + firm_type_label +
                        '<extra></extra>'
                    ),
                    legendgroup=firm_type_label, # Group for consistent legend item
                    showlegend=False # Legend will be handled by dummy traces
                ))
            else:
                print(f"Not enough data points for regression for {firm_type_label} firms in {year_to_plot}.")
        else:
            print(f"No {firm_type_label} firms found for {year_to_plot}.")
    return traces

# Get all unique years and sort them
all_years = df['year'].unique()
sorted_years = sorted(all_years)

# Create an empty figure
fig = go.Figure()

# Add dummy traces for persistent legend entries
# These traces are invisible on the plot but keep their legend entries visible
fig.add_trace(go.Scatter(
    x=[None], y=[None], # No actual data points
    mode='markers',
    marker=dict(color='#4E6688', size=8, opacity=0), # Invisible marker
    name='Domestic',
    legendgroup='Domestic',
    showlegend=True
))
fig.add_trace(go.Scatter(
    x=[None], y=[None], # No actual data points
    mode='markers',
    marker=dict(color='#79D7BE', size=8, opacity=0), # Invisible marker
    name='Multinational',
    legendgroup='Multinational',
    showlegend=True
))


# Add traces for all years, initially hidden except for the first year
for i, year in enumerate(sorted_years):
    year_traces = get_traces_for_year(df, year)
    for trace in year_traces:
        # Offset the index for visibility calculation because of the two dummy traces
        trace.visible = (year == sorted_years[0])
        fig.add_trace(trace)

# Create dropdown buttons
buttons = []
# The first two traces are dummy traces, so actual data traces start from index 2
num_dummy_traces = 2
num_traces_per_year = 4 # Each year has 2 scatter + 2 regression traces

for i, year in enumerate(sorted_years):
    visibility = [False] * len(fig.data) # Start with all hidden

    # Keep dummy traces visible in the legend (they are always visible=True)
    for k in range(num_dummy_traces):
        visibility[k] = True

    # Set visibility for the current year's actual data traces
    start_index = num_dummy_traces + i * num_traces_per_year
    end_index = start_index + num_traces_per_year
    for j in range(start_index, end_index):
        if j < len(fig.data): # Ensure index is within bounds
            visibility[j] = True

    buttons.append(
        dict(
            label=str(year),
            method='update',
            args=[
                {'visible': visibility}, # Set visibility for traces
                {'title': f'Predicted Profit Rate based on Sales and Firm Type ({year})'} # Update title
            ]
        )
    )

# Add dropdown to the layout
fig.update_layout(
    updatemenus=[
        go.layout.Updatemenu(
            active=0,
            buttons=buttons,
            direction="down",
            pad={"r": 10, "t": 10},
            showactive=True,
            x=0.1,
            xanchor="left",
            y=1.15,
            yanchor="top"
        ),
    ],
    title_text=f'Predicted Profit Rate based on Sales and Firm Type ({sorted_years[0]})',
    xaxis_title='Sales (PHP Billions)',
    yaxis_title='Profit Rate (%)',
    hovermode='closest',
    height=600,
    width=900,
    margin=dict(t=150) # Adjust top margin to make space for dropdown
)

fig.show()
# Save the figure to an HTML file
fig.write_html('predictive_chart.html', include_plotlyjs='cdn')