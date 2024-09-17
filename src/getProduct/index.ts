export const handler = async (event: any = {}): Promise<any> => {
    // Example response for /products
    const products = [
        { id: 1, name: "Product 1", price: 10 },
        { id: 2, name: "Product 2", price: 20 },
        { id: 3, name: "Product 3", price: 30 }
    ];

    return {
        statusCode: 200,
        body: JSON.stringify(products),
    };
};
